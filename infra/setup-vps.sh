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
#   - un pare-feu limité à SSH, HTTP et HTTPS.
#
# Ce que le script ne fait pas encore : Docker, Postgres et Umami arrivent en
# phase 2, avec la console d'administration.

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

✓ VPS prêt.

  Reste à faire, dans l'ordre :
    1. déposer ta clé publique dans /home/$DEPLOY_USER/.ssh/authorized_keys
    2. désactiver la connexion root et l'authentification par mot de passe
       dans /etc/ssh/sshd_config, puis : systemctl restart ssh
    3. copier infra/Caddyfile vers /etc/caddy/Caddyfile
    4. pour chaque client : pnpm caddy <slug> --out ./out puis déposer le
       fichier dans /etc/caddy/sites/ et recharger Caddy
    5. faire pointer le DNS du client (A / AAAA) vers ce serveur

  Rappel : les certificats sont obtenus automatiquement au premier accès,
  une fois le DNS propagé. Rien à faire de plus.
EOF
