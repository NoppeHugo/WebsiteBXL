#!/usr/bin/env bash
#
# Sauvegarde de la base, avec vérification.
#
#   /srv/repo/infra/sauvegarde.sh
#
# Lancé chaque nuit par une minuterie systemd (voir installer-exploitation.sh).
#
# ─── Pourquoi ce script existe ──────────────────────────────────────────────
#
# Les sites se reconstruisent depuis git. La base, non. Elle contient les
# rendez-vous, les messages des clients et l'audience : sa perte est
# irréversible, et rien ne la signale — un serveur sans sauvegarde fonctionne
# parfaitement jusqu'au jour où il ne fonctionne plus.
#
# ─── Ce qui distingue ce script d'un simple pg_dump ─────────────────────────
#
# Il **restaure** chaque sauvegarde dans une base jetable avant de la déclarer
# bonne. Une sauvegarde jamais restaurée n'est pas une sauvegarde : c'est un
# fichier dont on suppose le contenu. Les archives tronquées, les dumps
# interrompus et les erreurs de permission ne se voient pas autrement — sauf le
# jour de la restauration réelle, qui est le pire moment pour l'apprendre.
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINATION="${SAUVEGARDE_DIR:-/srv/sauvegardes}"
JOURS_CONSERVES="${SAUVEGARDE_JOURS:-30}"
HORODATAGE="$(date -u +%Y%m%d-%H%M%S)"
FICHIER="$DESTINATION/bxl-$HORODATAGE.sql.gz"

cd "$REPO/infra"

if [[ -f "$REPO/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	. "$REPO/.env"
	set +a
fi

echouer() {
	echo "ÉCHEC : $*" >&2
	if [[ -x /opt/node22/bin/node ]]; then
		printf 'La sauvegarde de la base a échoué.\n\n%s\n\nAucune sauvegarde neuve cette nuit. Les précédentes restent en place dans %s.\n' \
			"$*" "$DESTINATION" |
			/opt/node22/bin/node --experimental-strip-types \
				"$REPO/scripts/alerter.ts" "sauvegarde en échec" || true
	fi
	exit 1
}

mkdir -p "$DESTINATION"
# La sauvegarde contient les coordonnées des clients des salons : lisible par
# son propriétaire et personne d'autre.
chmod 700 "$DESTINATION"

echo "▸ vidage de la base"
# `-T` : pas de pseudo-terminal, sinon la sortie est polluée de caractères de
# contrôle qui corrompent l'archive.
if ! docker compose exec -T db pg_dump -U bxl --clean --if-exists bxl | gzip -9 >"$FICHIER"; then
	rm -f "$FICHIER"
	echouer "pg_dump n'a pas abouti"
fi

TAILLE="$(stat -c %s "$FICHIER")"
echo "    $FICHIER ($((TAILLE / 1024)) ko)"

# Un dump vide ou minuscule est un dump raté qui s'est terminé sans erreur.
if ((TAILLE < 1024)); then
	rm -f "$FICHIER"
	echouer "archive suspecte : $TAILLE octets"
fi

echo "▸ contrôle de l'archive"
gzip -t "$FICHIER" || { rm -f "$FICHIER"; echouer "archive gzip corrompue"; }

echo "▸ restauration d'essai"
#
# Dans une base jetable, jamais dans la base réelle : le dump commence par
# `drop`, et une erreur de cible effacerait ce qu'on cherche à protéger.
#
ESSAI="essai_restauration_$$"
nettoyer_essai() {
	docker compose exec -T db dropdb -U bxl --if-exists "$ESSAI" >/dev/null 2>&1 || true
}
trap nettoyer_essai EXIT

docker compose exec -T db createdb -U bxl "$ESSAI" ||
	echouer "impossible de créer la base d'essai"

if ! gunzip -c "$FICHIER" | docker compose exec -T db psql -U bxl -q -v ON_ERROR_STOP=1 -d "$ESSAI" >/dev/null; then
	rm -f "$FICHIER"
	echouer "l'archive ne se restaure pas"
fi

# On compte ce qui compte vraiment. Une base restaurée mais vide passerait
# toutes les vérifications techniques.
LIGNES="$(docker compose exec -T db psql -U bxl -t -A -d "$ESSAI" -c "
  select (select count(*) from tenants) || ' commerces, ' ||
         (select count(*) from appointments) || ' rendez-vous, ' ||
         (select count(*) from contact_messages) || ' messages, ' ||
         (select count(*) from admin_users) || ' comptes'
" 2>/dev/null | tr -d '\r')"

if [[ -z "$LIGNES" ]]; then
	rm -f "$FICHIER"
	echouer "la base restaurée ne répond pas aux requêtes"
fi
echo "    restaurée et interrogée : $LIGNES"

nettoyer_essai
trap - EXIT

echo "▸ rotation"
AVANT="$(find "$DESTINATION" -name 'bxl-*.sql.gz' | wc -l)"
find "$DESTINATION" -name 'bxl-*.sql.gz' -mtime "+$JOURS_CONSERVES" -delete
APRES="$(find "$DESTINATION" -name 'bxl-*.sql.gz' | wc -l)"
echo "    $APRES archive(s) conservée(s), $((AVANT - APRES)) supprimée(s) (> $JOURS_CONSERVES jours)"

# ─── Copie hors du serveur ──────────────────────────────────────────────────
#
# ⛔ Ces archives vivent sur le même disque que la base. Un disque perdu les
# emporte avec elle — ce qui n'est pas une sauvegarde, seulement une protection
# contre l'effacement accidentel.
#
# `SAUVEGARDE_DISTANTE` reçoit la commande à lancer, avec le chemin de
# l'archive en argument. Aucune destination n'est écrite ici : une adresse
# inventée créerait l'illusion d'une copie qui n'existe pas.
#
#   SAUVEGARDE_DISTANTE="rclone copy --config /home/deploy/.config/rclone/rclone.conf"
#   SAUVEGARDE_DISTANTE="scp -i /home/deploy/.ssh/sauvegarde"   # ... :destination/
#
if [[ -n "${SAUVEGARDE_DISTANTE:-}" ]]; then
	echo "▸ copie hors du serveur"
	if $SAUVEGARDE_DISTANTE "$FICHIER"; then
		echo "    copiée"
	else
		echouer "la copie hors du serveur a échoué (l'archive locale, elle, est bonne)"
	fi
else
	echo "▸ copie hors du serveur : non configurée (SAUVEGARDE_DISTANTE vide)"
	echo "    ⚠ un disque perdu emporterait la base ET ses sauvegardes"
fi

echo "✓ sauvegarde vérifiée : $FICHIER"
