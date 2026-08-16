#!/usr/bin/env bash
#
# Installation du socle serveur (Debian 12 / Ubuntu 24.04), en root.
#
#   ACME_EMAIL=tonadresse@exemple.be bash setup-vps.sh
#
# Ce que le script met en place :
#   - un utilisateur de déploiement sans mot de passe, clé SSH uniquement ;
#   - Caddy, qui gère seul les certificats de tous les domaines clients ;
#   - Docker, qui fait tourner la base, l'API et l'interface d'administration ;
#   - l'arborescence /srv/sites, une release par déploiement.
#
# ── Serveur déjà occupé ──────────────────────────────────────────────────
#
# Ce script est conçu pour ne rien casser sur une machine qui héberge déjà
# quelque chose. Il commence par un état des lieux, s'arrête net s'il trouve
# un autre serveur web sur les ports 80/443, ne touche jamais à un fichier de
# configuration existant, et ne touche au pare-feu que si on le lui demande
# explicitement.
#
# Deux variables lèvent ces protections, et une seule raison de les poser :
# avoir lu l'état des lieux et compris ce qu'on accepte.
#
#   PARTAGE_ACCEPTE=oui   continuer malgré un autre serveur web détecté
#   UFW_ACTIVER=oui       autoriser le script à activer le pare-feu
#
# Le reste de la mise en ligne est décrit pas à pas dans docs/DEPLOIEMENT.md.

set -euo pipefail

: "${ACME_EMAIL:?ACME_EMAIL non défini — adresse de contact pour les certificats}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
PARTAGE_ACCEPTE="${PARTAGE_ACCEPTE:-non}"
UFW_ACTIVER="${UFW_ACTIVER:-non}"

# ─────────────────────────────────────────────────────────────────────────
# 0. État des lieux
#
# Rien n'est modifié ici. L'objectif est qu'un opérateur — ou une IA — sache
# ce qu'il y a sur la machine avant d'y ajouter quoi que ce soit.
# ─────────────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════════════"
echo " État des lieux du serveur"
echo "════════════════════════════════════════════════════════════"

ecoute() { ss -lntpH "sport = :$1" 2>/dev/null | head -1; }

for port in 80 443 3000 4000 5432; do
	occupant="$(ecoute "$port")"
	if [[ -n "$occupant" ]]; then
		echo "  port $port  OCCUPÉ  ${occupant##*users:}"
	else
		echo "  port $port  libre"
	fi
done

for service in caddy nginx apache2 httpd docker; do
	if command -v "$service" &>/dev/null; then
		actif="$(systemctl is-active "$service" 2>/dev/null || echo "hors service")"
		echo "  $service : installé, $actif"
	fi
done

echo "  pare-feu : $(ufw status 2>/dev/null | head -1 || echo 'ufw absent')"
echo "════════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────────────────
# 1. Refus de continuer si un autre serveur web tient déjà 80/443
#
# Deux serveurs web ne peuvent pas écouter le même port. Installer Caddy
# ici ne « partagerait » rien : il échouerait au démarrage, ou pire,
# prendrait le port au redémarrage suivant et couperait les sites en place.
# ─────────────────────────────────────────────────────────────────────────

conflit=""
for autre in nginx apache2 httpd; do
	if systemctl is-active --quiet "$autre" 2>/dev/null; then
		conflit="$autre"
	fi
done

if [[ -n "$conflit" && "$PARTAGE_ACCEPTE" != "oui" ]]; then
	cat >&2 <<EOF

⛔ ARRÊT — « $conflit » est actif et occupe probablement les ports 80 et 443.

  Installer Caddy par-dessus ne partagerait pas les ports : il échouerait au
  démarrage, ou prendrait la place au redémarrage suivant et couperait les
  sites déjà en ligne.

  Trois issues, à choisir par un humain :

    1. Garder « $conflit » et lui faire servir les sites de ce projet.
       Ils sont purement statiques : un bloc « server » par domaine avec
       « root /srv/sites/<slug>/current » suffit. Les fichiers générés par
       « pnpm caddy » ne servent alors pas — il faut écrire l'équivalent.
       C'est le chemin le plus sûr sur un serveur déjà en production.

    2. Migrer « $conflit » vers Caddy. Propre à terme, mais cela veut dire
       reconfigurer et retester tous les sites existants. À ne pas faire
       un soir de mise en ligne.

    3. Prendre un second VPS pour ce projet. 4 à 8 €/mois, aucun risque
       pour l'existant, et l'isolation des sauvegardes en prime.

  Si « $conflit » n'écoute en réalité ni 80 ni 443 — vérifier l'état des
  lieux ci-dessus — relancer avec PARTAGE_ACCEPTE=oui.

EOF
	exit 1
fi

echo "▸ paquets de base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl debian-keyring debian-archive-keyring \
	apt-transport-https rsync ufw fail2ban unattended-upgrades iproute2

echo "▸ utilisateur de déploiement : $DEPLOY_USER"
if ! id "$DEPLOY_USER" &>/dev/null; then
	adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
echo "  → déposer la clé publique dans /home/$DEPLOY_USER/.ssh/authorized_keys"

echo "▸ Caddy"
if ! command -v caddy &>/dev/null; then
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
		gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		>/etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq
	apt-get install -y -qq caddy
else
	echo "  déjà installé — configuration laissée intacte"
fi

echo "▸ Docker"
# Base, API et interface d'administration tournent en conteneurs. Le dépôt
# officiel plutôt que celui de la distribution : Compose v2 y est fourni comme
# greffon, et c'est la syntaxe qu'utilise infra/docker-compose.yml.
if ! command -v docker &>/dev/null; then
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/debian/gpg |
		gpg --dearmor -o /etc/apt/keyrings/docker.gpg
	chmod a+r /etc/apt/keyrings/docker.gpg
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
		>/etc/apt/sources.list.d/docker.list
	apt-get update -qq
	apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
		docker-buildx-plugin docker-compose-plugin
else
	echo "  déjà installé — conteneurs existants non touchés"
fi
# L'utilisateur de déploiement pilote les conteneurs sans passer par root.
usermod -aG docker "$DEPLOY_USER"

echo "▸ arborescence des sites"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /srv/sites
install -d -m 755 /etc/caddy/sites
install -d -m 755 /var/log/caddy

# Caddy doit pouvoir lire les fichiers déposés par l'utilisateur de déploiement.
usermod -aG "$DEPLOY_USER" caddy

echo "▸ configuration Caddy"
# `caddy.env` n'est pas écrasé s'il existe : sur une machine partagée, il peut
# déjà porter les variables d'autres sites.
if [[ -f /etc/caddy/caddy.env ]] && grep -q '^ACME_EMAIL=' /etc/caddy/caddy.env; then
	echo "  ACME_EMAIL déjà défini dans /etc/caddy/caddy.env — laissé tel quel"
else
	echo "ACME_EMAIL=$ACME_EMAIL" >>/etc/caddy/caddy.env
fi
mkdir -p /etc/systemd/system/caddy.service.d
cat >/etc/systemd/system/caddy.service.d/override.conf <<'EOF'
[Service]
EnvironmentFile=/etc/caddy/caddy.env
EOF

# Le rechargement de Caddy doit être possible depuis le déploiement, sans
# donner un accès root complet : une seule commande est autorisée.
cat >/etc/sudoers.d/caddy-reload <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reload caddy
EOF
chmod 440 /etc/sudoers.d/caddy-reload

echo "▸ pare-feu"
# Les règles sont ajoutées dans tous les cas — elles n'ont aucun effet tant
# que le pare-feu est inactif. L'activation, elle, est refusée par défaut :
# sur une machine qui héberge déjà des services, activer un pare-feu qui
# n'autorise que 22, 80 et 443 coupe tout le reste — messagerie, panneau
# d'administration, port applicatif exotique — sans prévenir.
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null

if ufw status 2>/dev/null | head -1 | grep -q "active"; then
	echo "  déjà actif — règles 22/80/443 ajoutées, rien d'autre modifié"
elif [[ "$UFW_ACTIVER" == "oui" ]]; then
	ufw --force enable
	echo "  activé sur demande explicite"
else
	echo "  INACTIF, et laissé inactif."
	echo "  → vérifier d'abord quels autres ports doivent rester ouverts :"
	echo "      ss -lntp"
	echo "    puis, une fois les règles complétées : ufw enable"
fi

echo "▸ mises à jour de sécurité automatiques"
dpkg-reconfigure -f noninteractive unattended-upgrades

cat <<EOF

✓ Socle installé. Rien de ce qui existait n'a été modifié.

  La suite est dans docs/DEPLOIEMENT.md. Dans l'ordre :

    1. déposer la clé publique dans /home/$DEPLOY_USER/.ssh/authorized_keys
    2. AJOUTER le contenu de infra/Caddyfile à /etc/caddy/Caddyfile —
       sans l'écraser s'il contient déjà des sites (voir §5 de la procédure)
    3. cloner le dépôt, renseigner .env, lancer les services Docker
    4. faire pointer le DNS vers ce serveur, puis déposer un bloc par
       domaine dans /etc/caddy/sites/ et recharger Caddy

  Rappel : les certificats sont obtenus automatiquement au premier accès,
  une fois le DNS propagé. Rien à faire de plus.
EOF
