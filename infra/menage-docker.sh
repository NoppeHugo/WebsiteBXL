#!/usr/bin/env bash
#
# Ménage des restes de construction Docker.
#
#   /srv/repo/infra/menage-docker.sh [--sec]
#
# Lancé chaque semaine par une minuterie systemd.
#
# ─── Pourquoi ─────────────────────────────────────────────────────────────
#
# Chaque reconstruction de la console laisse derrière elle des couches
# d'image et un cache de construction. Rien ne les supprime, et ils grossissent
# sans limite : au relevé du 17 août 2026, 20 Go de cache et 7,8 Go d'images
# inutilisées, sur un disque de 96 Go occupé à 57 %.
#
# Un disque plein sur cette machine n'arrête pas que ce projet. Postgres cesse
# d'écrire, nginx aussi, et les quatre sites de production des autres projets
# tombent avec. C'est le seul point de rupture réellement partagé.
#
# ─── Ce qui n'est jamais supprimé ─────────────────────────────────────────
#
# Les images utilisées par un conteneur en marche, et les volumes. `docker
# volume prune` emporterait la base de données : il n'est pas ici, et il ne
# doit pas y venir.
#
set -euo pipefail

SEC=0
[[ "${1:-}" == "--sec" ]] && SEC=1

# Ne garde que le cache des sept derniers jours : une reconstruction dans la
# semaine réutilise ses couches, au-delà elles ne servent plus qu'à occuper.
AGE_CACHE="${MENAGE_AGE_CACHE:-168h}"

avant() { df --output=avail -k / | tail -1 | tr -dc '0-9'; }
humain() { numfmt --to=iec --suffix=B --format='%.1f' "$(($1 * 1024))"; }

LIBRE_AVANT="$(avant)"
echo "▸ avant : $(humain "$LIBRE_AVANT") libres"

if ((SEC)); then
	echo "▸ simulation — rien ne sera supprimé"
	docker system df
	exit 0
fi

echo "▸ cache de construction de plus de $AGE_CACHE"
docker builder prune --force --filter "until=$AGE_CACHE" 2>&1 | tail -2 | sed 's/^/    /'

echo "▸ images sans conteneur"
# `-a` retire aussi les images intermédiaires sans étiquette. Les images d'un
# conteneur en marche sont protégées par Docker lui-même.
docker image prune --all --force --filter "until=$AGE_CACHE" 2>&1 | tail -2 | sed 's/^/    /'

echo "▸ conteneurs arrêtés"
docker container prune --force 2>&1 | tail -1 | sed 's/^/    /'

LIBRE_APRES="$(avant)"
GAGNE=$((LIBRE_APRES - LIBRE_AVANT))
echo "▸ après : $(humain "$LIBRE_APRES") libres (+$(humain "${GAGNE#-}"))"

# On vérifie que le ménage n'a rien cassé : les trois conteneurs du projet
# doivent toujours tourner. Un `prune` mal ciblé se verrait ici, pas trois
# jours plus tard.
MANQUANTS=""
for conteneur in bxl-db-1 bxl-api-1 bxl-admin-1; do
	etat="$(docker inspect -f '{{.State.Status}}' "$conteneur" 2>/dev/null || echo absent)"
	[[ "$etat" == "running" ]] || MANQUANTS="$MANQUANTS $conteneur($etat)"
done

if [[ -n "$MANQUANTS" ]]; then
	echo "ATTENTION : conteneurs arrêtés après le ménage :$MANQUANTS" >&2
	exit 1
fi

echo "✓ ménage terminé, les trois services tournent toujours"
