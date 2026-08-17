#!/usr/bin/env bash
#
# Installe l'utilitaire qui publie un site dans nginx.
#
#   sudo bash infra/installer-vhost.sh
#
# À relancer après toute modification de `infra/bxl-vhost` ou de
# `infra/nginx/site.conf.modele` : ce qui s'exécute est la copie, pas le
# fichier du dépôt.
#
# ─── Pourquoi une copie, et pas un lien ─────────────────────────────────────
#
# La règle sudo installée ici donne root, sans mot de passe, à un programme
# précis. Si ce programme était le fichier du dépôt, ou un lien vers lui, alors
# quiconque peut écrire dans /srv/repo obtiendrait root — et la console
# d'administration écrit dans /srv/repo à chaque enregistrement de contenu. Un
# défaut de la console deviendrait un défaut du serveur entier.
#
# La copie appartient à root, en lecture seule pour tous les autres. La console
# peut la lancer ; elle ne peut pas la réécrire.
#
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
	echo "à lancer en root : sudo bash infra/installer-vhost.sh" >&2
	exit 1
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
	echo "compte « $DEPLOY_USER » inconnu — lancer d'abord infra/setup-vps-nginx.sh" >&2
	exit 1
fi

echo "▸ utilitaire"
install -o root -g root -m 0755 "$REPO/infra/bxl-vhost" /usr/local/sbin/bxl-vhost
echo "  /usr/local/sbin/bxl-vhost"

echo "▸ modèle de bloc nginx"
install -d -o root -g root -m 0755 /usr/local/share/bxl
install -o root -g root -m 0644 \
	"$REPO/infra/nginx/site.conf.modele" /usr/local/share/bxl/site.conf.modele
echo "  /usr/local/share/bxl/site.conf.modele"

echo "▸ règle sudo"
# Un seul programme, aucun autre. Les arguments restent libres : c'est
# `bxl-vhost` qui les valide, et il refuse tout ce qui n'est pas un identifiant
# ou un nom de domaine ordinaire.
cat >/etc/sudoers.d/bxl-vhost <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/sbin/bxl-vhost
EOF
chmod 440 /etc/sudoers.d/bxl-vhost

# Une règle sudo invalide rend `sudo` inutilisable pour tout le monde, y compris
# pour la réparer. On vérifie avant de laisser le fichier en place.
if visudo -cf /etc/sudoers.d/bxl-vhost >/dev/null; then
	echo "  règle sudoers valide"
else
	rm -f /etc/sudoers.d/bxl-vhost
	echo "règle sudoers invalide — retirée, rien n'a changé." >&2
	exit 1
fi

echo
echo "✓ installé. Vérification :"
sudo -n -u "$DEPLOY_USER" sudo -n /usr/local/sbin/bxl-vhost 2>&1 | head -2 | sed 's/^/    /' || true
echo
echo "  Une sortie « usage : bxl-vhost <slug> <domaine> » est le bon résultat :"
echo "  le compte $DEPLOY_USER peut lancer l'utilitaire, qui refuse un appel vide."
