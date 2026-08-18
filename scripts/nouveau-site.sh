#!/usr/bin/env bash
#
# Installe un client tout juste créé par la console, sur la machine hôte.
#
#   ./scripts/nouveau-site.sh <slug>
#
# Suite de `scripts/publier.sh`, et pour les mêmes raisons : ce travail ne peut
# pas se faire depuis le conteneur de la console. S'y ajoutent ici deux choses
# qui n'existent que sur l'hôte — les visuels de remplacement, qui demandent
# sharp compilé pour la glibc, et le bloc nginx, qui demande root.
#
# La console a déjà écrit `clients/<slug>/site.json` et `theme.json`, enregistré
# le commerce en base, commité et poussé. Ce script reprend là.
#
# Ordre imposé, et non arbitraire :
#   1. les visuels, parce que le build refuse une photo d'accueil manquante ;
#   2. la construction et le déploiement, parce que le certificat se demande
#      par une vérification HTTP : le domaine doit déjà servir quelque chose ;
#   3. le bloc nginx et le certificat en dernier.
#
set -euo pipefail

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
	echo "usage : ./scripts/nouveau-site.sh <slug>" >&2
	exit 1
fi

# Revalidé ici même si la console l'a déjà fait : ce script est appelé par ssh,
# et un identifiant est ensuite recopié dans des chemins et des commandes.
if [[ ! "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
	echo "identifiant refusé : « $SLUG » (minuscules, chiffres et tirets)" >&2
	exit 1
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

if [[ ! -d "clients/$SLUG" ]]; then
	echo "clients/$SLUG n'existe pas — la console ne l'a pas créé." >&2
	exit 1
fi

# Une session ssh non interactive ne lit pas .bashrc.
export PATH="/opt/node22/bin:$PATH"
if ! command -v pnpm >/dev/null; then
	echo "pnpm introuvable. Attendu dans /opt/node22/bin (voir infra/setup-vps-nginx.sh)." >&2
	exit 1
fi

if [[ -f .env ]]; then
	set -a
	# shellcheck disable=SC1091
	. ./.env
	set +a
fi

# Le domaine est lu dans le fichier plutôt que reçu en argument : ce qui est
# servi doit être ce qui est écrit, sans qu'un troisième endroit puisse en
# décider autrement. Le slug passe par l'environnement et non par le source du
# script node, pour qu'il n'y ait rien à interpréter.
DOMAINE="$(SLUG="$SLUG" node -e '
  const { readFileSync } = require("node:fs");
  const site = JSON.parse(readFileSync(`clients/${process.env.SLUG}/site.json`, "utf8"));
  process.stdout.write(site.domain || "");
')"

if [[ -z "$DOMAINE" ]]; then
	echo "aucun domaine dans clients/$SLUG/site.json" >&2
	exit 1
fi

echo "▸ 1/4  visuels de remplacement"
#
# Générés seulement si le client n'a aucune image.
#
# Ils portent des noms fixes — hero.jpg, galerie-1.jpg… — et les régénérer
# écraserait des photos existantes portant les mêmes noms. C'est précisément le
# cas d'un site **dupliqué**, qui arrive avec la photothèque de son modèle : la
# première mise en ligne aurait remplacé les vraies photos par des dégradés,
# sans un mot.
#
# Un client créé de zéro a un dossier `media` vide : il les reçoit bien.
if [[ -z "$(find "clients/$SLUG/media" -maxdepth 1 -type f \
	\( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
	-print -quit 2>/dev/null)" ]]; then
	pnpm placeholders "$SLUG" 2>&1 | sed 's/^/    /'
else
	echo "    le client a déjà ses images — rien à générer"
fi

git add "clients/$SLUG"
if ! git diff --cached --quiet; then
	git commit -m "visuels de remplacement : $SLUG" --quiet
	git push --quiet
	echo "    visuels versionnés et poussés"
else
	echo "    déjà à jour"
fi

echo "▸ 2/4  construction"
pnpm build "$SLUG" 2>&1 | tail -12 | sed 's/^/    /'

echo "▸ 3/4  déploiement"
./scripts/deploy.sh "$SLUG" 2>&1 | sed 's/^/    /'

echo "▸ 4/4  bloc nginx et certificat"
# L'utilitaire vit hors du dépôt, dans /usr/local/sbin, et lui seul est autorisé
# par sudo. Y appeler un script du dépôt reviendrait à donner root à quiconque
# peut écrire dedans — c'est-à-dire à la console.
if [[ ! -x /usr/local/sbin/bxl-vhost ]]; then
	echo "    /usr/local/sbin/bxl-vhost absent : lancer une fois, en root," >&2
	echo "    bash $REPO/infra/installer-vhost.sh" >&2
	exit 1
fi
sudo -n /usr/local/sbin/bxl-vhost "$SLUG" "$DOMAINE" 2>&1 | sed 's/^/    /'

echo
echo "✓ $SLUG installé"
echo "  https://$DOMAINE  →  $(curl -sI --max-time 15 "https://$DOMAINE" | head -1 || echo 'sans réponse')"
