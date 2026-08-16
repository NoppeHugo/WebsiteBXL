#!/usr/bin/env bash
#
# Socle du serveur — variante « nginx déjà en place » (§0 bis, option 1).
#
#   sudo bash infra/setup-vps-nginx.sh
#
# Pourquoi ce script double `setup-vps.sh` : l'original installe Caddy et
# s'arrête de lui-même si nginx tourne, ce qui est exactement le cas de ce VPS.
# Celui-ci fait le reste du socle — utilisateur `deploy`, `/srv/sites`, droit de
# recharger nginx, règles de pare-feu — et **ne touche ni à la configuration
# nginx existante, ni aux conteneurs déjà en service, ni au pare-feu actif**.
#
# Il est relançable : chaque étape vérifie avant d'agir.
#
# Ce qu'il ne fait volontairement PAS, par rapport à `setup-vps.sh` :
#   - installer Caddy               → nginx sert déjà cette machine ;
#   - installer fail2ban            → durcissement non demandé ; sur un serveur
#                                     en service il peut bannir un accès légitime,
#                                     c'est une décision de l'exploitant ;
#   - activer le pare-feu           → il est déjà actif, on n'y touche pas ;
#   - toucher à sshd_config         → `PasswordAuthentication no` est déjà en place.

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $EUID -ne 0 ]]; then
	echo "Ce script doit être lancé en root : sudo bash $0" >&2
	exit 1
fi

echo "▸ état des lieux (avant toute modification)"
echo "  serveur web actif  : $(systemctl is-active nginx 2>/dev/null) (nginx)"
echo "  sites nginx en place : $(ls /etc/nginx/sites-enabled/ 2>/dev/null | tr '\n' ' ')"
echo "  conteneurs         : $(docker ps -q 2>/dev/null | wc -l) en cours"
echo "  pare-feu           : $(ufw status 2>/dev/null | head -1)"
echo

echo "▸ paquets de base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
# Volontairement minimal : tout le reste est déjà présent sur cette machine.
apt-get install -y -qq rsync curl

echo "▸ utilisateur de déploiement : $DEPLOY_USER"
if ! id "$DEPLOY_USER" &>/dev/null; then
	adduser --disabled-password --gecos "" "$DEPLOY_USER"
	echo "  créé"
else
	echo "  existe déjà — laissé tel quel"
fi
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

# L'utilisateur de déploiement pilote les conteneurs sans passer par root.
usermod -aG docker "$DEPLOY_USER"

echo "▸ arborescence des sites"
# 755 : nginx tourne en www-data et doit pouvoir lire les fichiers déposés par
# `deploy`. Pas besoin d'ajouter www-data au groupe deploy pour autant.
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /srv/sites
echo "  /srv/sites prêt"

echo "▸ fragment nginx commun"
# Jamais écrasé : sur une machine partagée, un fichier de ce nom pourrait déjà
# servir à autre chose.
if [[ -f /etc/nginx/snippets/bxl-commun.conf ]]; then
	echo "  déjà présent — laissé tel quel (comparer avec infra/nginx/bxl-commun.conf)"
else
	install -d -m 755 /etc/nginx/snippets
	install -m 644 "$REPO_DIR/infra/nginx/bxl-commun.conf" /etc/nginx/snippets/bxl-commun.conf
	echo "  déposé dans /etc/nginx/snippets/bxl-commun.conf"
fi

echo "▸ droit de recharger nginx sans root complet"
cat >/etc/sudoers.d/bxl-nginx-reload <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reload nginx
EOF
chmod 440 /etc/sudoers.d/bxl-nginx-reload
visudo -cf /etc/sudoers.d/bxl-nginx-reload >/dev/null && echo "  règle sudoers valide"

echo "▸ pare-feu"
# Les règles sont ajoutées ; l'activation, jamais. Sur cette machine UFW est
# déjà actif et protège d'autres services : y toucher les couperait.
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
if ufw status 2>/dev/null | head -1 | grep -q "active"; then
	echo "  déjà actif — règles 22/80/443 confirmées, rien d'autre modifié"
else
	echo "  INACTIF, et laissé inactif (décision de l'exploitant)."
fi

echo
echo "▸ vérification finale — les sites déjà en ligne doivent être intacts"
nginx -t
for d in collierscolliersmaison.be eventmemories.be noppevisuals.be rappl.be; do
	printf '  %-28s %s\n' "$d" "$(curl -sI --max-time 15 "https://$d" | head -1 || echo ÉCHEC)"
done

echo
echo "Socle en place. Aucune configuration nginx existante n'a été modifiée."
echo "Suite : déposer la clé publique de l'exploitant dans"
echo "  /home/$DEPLOY_USER/.ssh/authorized_keys   (§3)"
