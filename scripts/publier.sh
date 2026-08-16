#!/usr/bin/env bash
#
# Construit puis déploie un site, sur la machine hôte.
#
#   ./scripts/publier.sh <slug>
#
# Ce script existe pour être appelé **par la console d'administration**, qui
# tourne en conteneur et ne peut pas faire ce travail elle-même :
#
#   - son image n'embarque que `apps/admin` et `apps/api` ; ni Astro ni le
#     template n'y sont installés, `pnpm build` s'y arrête aussitôt ;
#   - `scripts/deploy.sh` passe par ssh et rsync vers DEPLOY_HOST, et depuis un
#     conteneur « localhost » désigne le conteneur, pas la machine.
#
# Tout ce qu'il faut — Node 22, pnpm, les dépendances, /srv/sites — vit sur
# l'hôte. La console s'y connecte en ssh et lance ce script.
#
set -euo pipefail

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
	echo "usage : ./scripts/publier.sh <slug>" >&2
	exit 1
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

# Une session ssh non interactive ne lit pas .bashrc : le PATH doit être posé
# ici, sinon c'est le Node du système — trop ancien pour ce dépôt — qui répond.
export PATH="/opt/node22/bin:$PATH"

if ! command -v pnpm >/dev/null; then
	echo "pnpm introuvable. Attendu dans /opt/node22/bin (voir infra/setup-vps-nginx.sh)." >&2
	exit 1
fi

# PUBLIC_API_URL est figée dans le HTML au moment du build : absente, le site
# se construit sans formulaire ni réservation, sans erreur visible.
if [[ -f .env ]]; then
	set -a
	# shellcheck disable=SC1091
	. ./.env
	set +a
fi

echo "▸ construction de $SLUG"
pnpm build "$SLUG"

echo "▸ déploiement de $SLUG"
./scripts/deploy.sh "$SLUG"

echo "✓ $SLUG est en ligne"
