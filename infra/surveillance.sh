#!/usr/bin/env bash
#
# Surveillance du serveur et des sites.
#
#   /srv/repo/infra/surveillance.sh [--verbeux]
#
# Lancé toutes les dix minutes par une minuterie systemd.
#
# ─── Principe : ne parler que lorsque quelque chose ne va pas ───────────────
#
# Une surveillance qui écrit tous les jours n'est plus lue au bout d'une
# semaine, et l'alerte qui compte se perd dans le flot. Ce script n'envoie un
# courriel qu'au passage du bon au mauvais, et un second au retour à la
# normale. Un problème qui dure ne réécrit pas toutes les dix minutes.
#
# L'état est gardé dans un fichier par contrôle : c'est lui qui distingue
# « toujours en panne » de « vient de tomber ».
#
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ETAT_DIR="${SURVEILLANCE_ETAT:-/var/lib/bxl-surveillance}"
VERBEUX=0
[[ "${1:-}" == "--verbeux" ]] && VERBEUX=1

mkdir -p "$ETAT_DIR"

if [[ -f "$REPO/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	. "$REPO/.env"
	set +a
fi

alerter() {
	local sujet="$1" corps="$2"
	echo "  → alerte : $sujet"
	if [[ -x /opt/node22/bin/node ]]; then
		printf '%s\n' "$corps" |
			/opt/node22/bin/node --experimental-strip-types \
				"$REPO/scripts/alerter.ts" "$sujet" || true
	fi
}

#
# Enregistre le résultat d'un contrôle et n'alerte qu'au changement d'état.
#
#   controler <nom> <ok|ko> <description du problème>
#
controler() {
	local nom="$1" resultat="$2" detail="${3:-}"
	local fichier="$ETAT_DIR/$nom"
	local precedent="ok"
	[[ -f "$fichier" ]] && precedent="$(cat "$fichier")"

	echo "$resultat" >"$fichier"

	if [[ "$resultat" == "ko" && "$precedent" == "ok" ]]; then
		alerter "$nom ne répond plus" "$detail"
	elif [[ "$resultat" == "ok" && "$precedent" == "ko" ]]; then
		alerter "$nom est revenu à la normale" "Le contrôle « $nom » repasse au vert."
	fi

	if ((VERBEUX)); then
		printf '  %-34s %s%s\n' "$nom" "$resultat" \
			"$([[ -n "$detail" && "$resultat" == "ko" ]] && echo " — $detail")"
	fi
}

echo "▸ surveillance $(date -u +%FT%TZ)"

# ─── Sites servis par nginx ─────────────────────────────────────────────────
#
# Tous les noms que nginx connaît, y compris les sites de production des autres
# projets : c'est la machine entière qu'on surveille, pas seulement ce dépôt.
# Un site voisin qui tombe à cause d'un disque plein doit se voir ici.

HOTES="$(
	{
		nginx -T 2>/dev/null |
			sed -n 's/^[[:space:]]*server_name[[:space:]]\+\(.*\);[[:space:]]*$/\1/p' |
			tr ' ' '\n' | grep -vE '^(_|\*|$)' | sort -u
	} || true
)"

while read -r hote; do
	[[ -z "$hote" ]] && continue
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$hote" || echo 000)"
	# Tout code renvoyé par le serveur vaut mieux que pas de réponse : une
	# redirection ou un 404 signifie que nginx et le réseau fonctionnent.
	if [[ "$code" == "000" || "$code" =~ ^5 ]]; then
		controler "site $hote" ko "https://$hote répond « ${code} »."
	else
		controler "site $hote" ok
	fi
done <<<"$HOTES"

# ─── API et console ─────────────────────────────────────────────────────────

# L'adresse vient du .env, celle-là même qui est figée dans les sites au build :
# surveiller une autre adresse que celle qu'ils appellent ne prouverait rien.
API_URL="${PUBLIC_API_URL:-}"
SANTE=""
if [[ -n "$API_URL" ]]; then
	SANTE="$(curl -s --max-time 10 "${API_URL%/}/health" || echo '')"
fi
if [[ -z "$API_URL" ]]; then
	# Ne pas déclarer l'API en panne parce qu'on ne sait pas où la joindre :
	# une fausse alerte apprend à ignorer les vraies.
	((VERBEUX)) && echo "  api                                (PUBLIC_API_URL absente du .env)"
elif [[ "$SANTE" == *'"ok":true'* ]]; then
	controler "api" ok
else
	controler "api" ko "Le contrôle de santé de l'API ne répond pas correctement. Réponse : ${SANTE:-aucune}. La réservation et les formulaires de contact de tous les sites sont hors service."
fi

# ─── Conteneurs ─────────────────────────────────────────────────────────────

for conteneur in bxl-db-1 bxl-api-1 bxl-admin-1; do
	etat="$(docker inspect -f '{{.State.Status}}' "$conteneur" 2>/dev/null || echo absent)"
	if [[ "$etat" == "running" ]]; then
		controler "conteneur $conteneur" ok
	else
		controler "conteneur $conteneur" ko "Le conteneur $conteneur est « $etat »."
	fi
done

# ─── Disque ─────────────────────────────────────────────────────────────────
#
# Le point de rupture partagé de cette machine. Un disque plein n'arrête pas
# que ce projet : Postgres cesse d'écrire, nginx aussi, et les sites des autres
# projets tombent avec. On alerte tôt, à 80 %, pour qu'il reste du temps.

UTILISE="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
LIBRE="$(df -h --output=avail / | tail -1 | tr -d ' ')"
if ((UTILISE >= 80)); then
	controler "espace disque" ko \
		"Le disque est occupé à ${UTILISE} % ($LIBRE libres). Un disque plein arrête Postgres, nginx et TOUS les sites de la machine, y compris ceux des autres projets. Libérer : docker builder prune -af && docker image prune -af"
else
	controler "espace disque" ok
fi

# ─── Certificats ────────────────────────────────────────────────────────────
#
# `certbot.timer` renouvelle tout seul, mais son échec est silencieux. Un
# certificat expiré rend le site inaccessible avec un avertissement de sécurité
# — le pire visuel possible pour un commerce.

if [[ -d /etc/letsencrypt/live ]]; then
	for cert in /etc/letsencrypt/live/*/cert.pem; do
		[[ -e "$cert" ]] || continue
		nom="$(basename "$(dirname "$cert")")"
		fin="$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)"
		[[ -z "$fin" ]] && continue
		jours=$((($(date -d "$fin" +%s) - $(date +%s)) / 86400))
		# Certbot renouvelle à 30 jours. En dessous de 14, c'est qu'il a échoué
		# au moins deux fois sans que personne ne le sache.
		if ((jours < 14)); then
			controler "certificat $nom" ko \
				"Le certificat de $nom expire dans $jours jour(s). Le renouvellement automatique n'a pas fonctionné. Relancer : certbot renew --dry-run puis certbot renew"
		else
			controler "certificat $nom" ok
		fi
	done
fi

# ─── Sauvegardes ────────────────────────────────────────────────────────────
#
# Une sauvegarde qui s'arrête sans prévenir est aussi grave que pas de
# sauvegarde du tout — pire, même, parce qu'on croit en avoir une.

DESTINATION="${SAUVEGARDE_DIR:-/srv/sauvegardes}"
RECENTE="$(find "$DESTINATION" -name 'bxl-*.sql.gz' -mtime -2 2>/dev/null | head -1)"
if [[ -n "$RECENTE" ]]; then
	controler "sauvegarde" ok
else
	controler "sauvegarde" ko \
		"Aucune sauvegarde de moins de deux jours dans $DESTINATION. La base contient les rendez-vous et les messages des clients : sa perte est irréversible. Vérifier : systemctl status bxl-sauvegarde.service"
fi

echo "✓ contrôles terminés"
