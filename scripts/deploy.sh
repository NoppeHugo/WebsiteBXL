#!/usr/bin/env bash
#
# Déploiement d'un site sur le VPS.
#
#   ./scripts/deploy.sh demo-barbier
#
# Chaque déploiement écrit une nouvelle release puis bascule un lien
# symbolique. La bascule est atomique : le visiteur ne voit jamais un site
# à moitié copié, et le retour arrière est immédiat.
#
#   ssh $DEPLOY_HOST 'ln -sfn /srv/sites/<slug>/releases/<précédente> /srv/sites/<slug>/current'
#
# Variables attendues (dans .env ou l'environnement) :
#   DEPLOY_HOST   utilisateur@serveur
#   DEPLOY_ROOT   racine des sites sur le VPS (défaut : /srv/sites)
#   KEEP_RELEASES nombre de releases conservées (défaut : 5)

set -euo pipefail

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
	echo "usage : ./scripts/deploy.sh <slug>" >&2
	exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$REPO_ROOT/.env" ]] && source "$REPO_ROOT/.env"

: "${DEPLOY_HOST:?DEPLOY_HOST non défini (utilisateur@serveur)}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/srv/sites}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

LOCAL_DIST="$REPO_ROOT/dist/$SLUG"
if [[ ! -d "$LOCAL_DIST" ]]; then
	echo "dist/$SLUG absent — lancer d'abord : pnpm build $SLUG" >&2
	exit 1
fi

# Refuse de déployer un site non validé : c'est le second garde-fou du
# monorepo, après le contrôle en intégration continue.
if ! grep -q '"status": *"live"' "$REPO_ROOT/clients/$SLUG/site.json"; then
	echo "clients/$SLUG/site.json n'est pas en statut « live » — déploiement annulé." >&2
	echo "Passer status à \"live\" (ou \"suspended\" pour couper le site) puis relancer." >&2
	exit 1
fi

RELEASE="$(date -u +%Y%m%d-%H%M%S)"
TARGET="$DEPLOY_ROOT/$SLUG"

echo "▸ déploiement de $SLUG vers $DEPLOY_HOST:$TARGET/releases/$RELEASE"

ssh "$DEPLOY_HOST" "mkdir -p '$TARGET/releases/$RELEASE'"

rsync --archive --compress --delete \
	--chmod=D755,F644 \
	"$LOCAL_DIST/" \
	"$DEPLOY_HOST:$TARGET/releases/$RELEASE/"

# Bascule atomique : `ln -sfn` via un lien temporaire puis `mv -T`, pour que le
# lien ne soit jamais absent, même une fraction de seconde.
ssh "$DEPLOY_HOST" "
	set -e
	ln -sfn '$TARGET/releases/$RELEASE' '$TARGET/current.tmp'
	mv -Tf '$TARGET/current.tmp' '$TARGET/current'
	ls -1dt '$TARGET/releases/'*/ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
"

echo "✓ $SLUG en ligne (release $RELEASE, $KEEP_RELEASES conservées)"
