#!/usr/bin/env bash
#
# Installation initiale du VPS (Debian 12 / Ubuntu 24.04).
# À lancer une seule fois, en root, sur un serveur neuf.
#
#   ACME_EMAIL=tonadresse@exemple.be bash setup-vps.sh
#
# Ce que le script met en place :
#   - un utilisateur de déploiement sans mot de passe, clé SSH uniquement ;
#   - Caddy, qui gère seul les certificats de tous les domaines clients ;
#   - l'arborescence /srv/sites, une release par déploiement ;
#   - Docker, qui fait tourner la base, l'API et l'interface d'administration ;
#   - un pare-feu limité à SSH, HTTP et HTTPS.
#
# Ce qu'il ne fait pas, volontairement : rien qui demande un secret ou une
# décision. Le reste de la mise en ligne est décrit pas à pas dans
# docs/DEPLOIEMENT.md.

set -euo pipefail

: "${ACME_EMAIL:?ACME_EMAIL non défini (adresse pour Let's Encrypt)}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

echo "▸ paquets de base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl debian-keyring debian-archive-keyring \
	apt-transport-https rsync ufw fail2ban unattended-upgrades

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
cat >/etc/caddy/caddy.env <<EOF
ACME_EMAIL=$ACME_EMAIL
EOF
mkdir -p /etc/systemd/system/caddy.service.d
cat >/etc/systemd/system/caddy.service.d/override.conf <<'EOF'
[Service]
EnvironmentFile=/etc/caddy/caddy.env
EOF
echo "  → copier infra/Caddyfile vers /etc/caddy/Caddyfile, puis :"
echo "    systemctl daemon-reload && systemctl reload caddy"

# Le rechargement de Caddy doit être possible depuis le déploiement, sans
# donner un accès root complet : une seule commande est autorisée.
cat >/etc/sudoers.d/caddy-reload <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reload caddy
EOF
chmod 440 /etc/sudoers.d/caddy-reload

echo "▸ pare-feu"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "▸ mises à jour de sécurité automatiques"
dpkg-reconfigure -f noninteractive unattended-upgrades

cat <<EOF

✓ Socle installé.

  La suite est décrite pas à pas dans docs/DEPLOIEMENT.md, à partir de
  l'étape 4. En résumé, et dans cet ordre :

    1. déposer ta clé publique dans /home/$DEPLOY_USER/.ssh/authorized_keys
    2. désactiver la connexion root et l'authentification par mot de passe
       dans /etc/ssh/sshd_config, puis : systemctl restart ssh
    3. copier infra/Caddyfile vers /etc/caddy/Caddyfile
    4. cloner le dépôt, renseigner .env, lancer les services Docker
    5. faire pointer le DNS vers ce serveur, puis déposer un bloc par
       domaine dans /etc/caddy/sites/ et recharger Caddy

  Rappel : les certificats sont obtenus automatiquement au premier accès,
  une fois le DNS propagé. Rien à faire de plus.
EOF
