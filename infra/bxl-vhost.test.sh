#!/usr/bin/env bash
#
# Vérifie la logique de bxl-vhost sans toucher au vrai nginx.
#
#   bash infra/bxl-vhost.test.sh
#
# On rejoue le script avec un faux `nginx`, un faux `systemctl`, un faux
# `certbot` et un faux `curl`, dans une arborescence jetable. Ce qui est testé :
# les refus, le relevé avant/après, et le retour arrière.
#
# Pourquoi cet effort pour une centaine de lignes de shell : ce script tourne en
# root sur une machine qui héberge des sites en production. Ses deux garde-fous
# — refuser une entrée mal formée, revenir en arrière si un site déjà en ligne
# cesse de répondre — ne se déclenchent jamais en usage normal. Ils ne seraient
# donc jamais éprouvés autrement que le jour où ils doivent servir.
#
# Ne fait aucun appel réseau et n'écrit rien hors d'un dossier temporaire : peut
# se lancer sur le serveur de production sans précaution.
#
set -uo pipefail

BAC="$(mktemp -d)"
trap 'rm -rf "$BAC"' EXIT

DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$DEPOT/infra/bxl-vhost"

# --- faux outils ------------------------------------------------------------
mkdir -p "$BAC/bin" "$BAC/etc/nginx/sites-available" "$BAC/etc/nginx/sites-enabled" \
	"$BAC/srv/sites/salon-marie/current" "$BAC/usr/local/share/bxl" "$BAC/etc/letsencrypt"

cat >"$BAC/bin/nginx" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "-T" ]]; then
  echo "    server_name rappl.be;"
  echo "    server_name demo.hairbxl.be;"
  echo "    server_name _;"
  for f in "$RACINE_TEST/etc/nginx/sites-enabled/"*; do
    [[ -e "$f" ]] || continue
    grep -h "server_name" "$f" || true
  done
  exit 0
fi
if [[ "${1:-}" == "-t" ]]; then
  if [[ -n "${NGINX_REFUSE:-}" ]]; then
    echo "nginx: configuration file test failed" >&2
    exit 1
  fi
  echo "nginx: configuration file test is successful"
  exit 0
fi
EOF

cat >"$BAC/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
echo "systemctl $*" >>"$RACINE_TEST/journal"
EOF

cat >"$BAC/bin/certbot" <<'EOF'
#!/usr/bin/env bash
echo "certbot $*" >>"$RACINE_TEST/journal"
[[ -n "${CERTBOT_ECHOUE:-}" ]] && exit 1
exit 0
EOF

# Le faux curl répond 200, sauf pour les hôtes listés dans HOTES_MORTS.
cat >"$BAC/bin/curl" <<'EOF'
#!/usr/bin/env bash
cible="${*: -1}"
for mort in ${HOTES_MORTS:-}; do
  if [[ "$cible" == *"$mort"* ]]; then echo -n "000"; exit 0; fi
done
echo -n "200"
EOF

chmod +x "$BAC/bin/"*

# --- script sous test, avec ses chemins déplacés ----------------------------
sed \
	-e "s|/etc/nginx|$BAC/etc/nginx|g" \
	-e "s|/srv/sites|$BAC/srv/sites|g" \
	-e "s|/usr/local/share/bxl|$BAC/usr/local/share/bxl|g" \
	-e "s|/etc/letsencrypt|$BAC/etc/letsencrypt|g" \
	"$SOURCE" >"$BAC/bin/bxl-vhost-test"
chmod +x "$BAC/bin/bxl-vhost-test"

# Le modèle porte lui aussi le chemin /srv/sites : le déplacer de la même
# façon, sans quoi le bloc écrit désignerait la vraie arborescence.
sed "s|/srv/sites|$BAC/srv/sites|g" \
	$DEPOT/infra/nginx/site.conf.modele \
	>"$BAC/usr/local/share/bxl/site.conf.modele"

export RACINE_TEST="$BAC"
export PATH="$BAC/bin:$PATH"

reussites=0
echecs=0
verifier() {
	local nom="$1" attendu="$2" obtenu="$3"
	if [[ "$attendu" == "$obtenu" ]]; then
		printf '  \033[32m✓\033[0m %s\n' "$nom"
		reussites=$((reussites + 1))
	else
		printf '  \033[31m✗\033[0m %s (attendu %s, obtenu %s)\n' "$nom" "$attendu" "$obtenu"
		echecs=$((echecs + 1))
	fi
}

lancer() { bxl-vhost-test "$@" >"$BAC/sortie" 2>&1; echo $?; }

echo "▸ refus d'entrées mal formées"
verifier "identifiant avec un point-virgule" 1 "$(lancer 'a;rm -rf /' exemple.be)"
verifier "identifiant en majuscules"         1 "$(lancer 'Salon' exemple.be)"
verifier "domaine avec espace"               1 "$(lancer salon-marie 'a b.be')"
verifier "domaine avec barre oblique"        1 "$(lancer salon-marie 'x.be/../../etc')"
verifier "domaine sans point"                1 "$(lancer salon-marie 'localhost')"
verifier "arguments manquants"               1 "$(lancer)"

echo "▸ refus quand le site n'est pas déployé"
verifier "racine absente" 1 "$(lancer pas-deploye pas-deploye.hairbxl.be)"

echo "▸ refus de toucher à un site existant"
verifier "domaine déjà servi par un autre bloc" 1 "$(lancer salon-marie rappl.be)"
echo "server_name autre.be;" >"$BAC/etc/nginx/sites-available/autre.be"
echo "root /ailleurs;" >>"$BAC/etc/nginx/sites-available/autre.be"
verifier "fichier existant qui sert autre chose" 1 "$(lancer salon-marie autre.be)"

echo "▸ création nominale"
code="$(lancer salon-marie salon-marie.hairbxl.be)"
verifier "sortie" 0 "$code"
verifier "bloc écrit" "oui" \
	"$([[ -f "$BAC/etc/nginx/sites-available/salon-marie.hairbxl.be" ]] && echo oui || echo non)"
verifier "bloc activé" "oui" \
	"$([[ -L "$BAC/etc/nginx/sites-enabled/salon-marie.hairbxl.be" ]] && echo oui || echo non)"
verifier "racine substituée" "oui" \
	"$(grep -q "root $BAC/srv/sites/salon-marie/current;" \
		"$BAC/etc/nginx/sites-available/salon-marie.hairbxl.be" && echo oui || echo non)"
verifier "rechargement, jamais redémarrage" "oui" \
	"$(grep -q 'systemctl reload nginx' "$BAC/journal" && ! grep -q 'restart' "$BAC/journal" && echo oui || echo non)"
verifier "certificat demandé" "oui" \
	"$(grep -q 'certbot --nginx -d salon-marie.hairbxl.be' "$BAC/journal" && echo oui || echo non)"

echo "▸ relance après coup (le bloc est déjà là)"
verifier "relance acceptée" 0 "$(lancer salon-marie salon-marie.hairbxl.be)"

echo "▸ nginx refuse la configuration"
rm -f "$BAC/etc/nginx/sites-available/salon2.hairbxl.be" "$BAC/etc/nginx/sites-enabled/salon2.hairbxl.be"
mkdir -p "$BAC/srv/sites/salon2/current"
code="$(NGINX_REFUSE=1 lancer salon2 salon2.hairbxl.be)"
verifier "sortie en échec" 1 "$code"
verifier "bloc retiré" "oui" \
	"$([[ ! -e "$BAC/etc/nginx/sites-available/salon2.hairbxl.be" ]] && echo oui || echo non)"
verifier "lien retiré" "oui" \
	"$([[ ! -e "$BAC/etc/nginx/sites-enabled/salon2.hairbxl.be" ]] && echo oui || echo non)"

echo "▸ un site de production tombe après le rechargement"
mkdir -p "$BAC/srv/sites/salon3/current"
code="$(HOTES_MORTS="" lancer salon3 salon3.hairbxl.be)"
verifier "création préalable réussie" 0 "$code"
rm -f "$BAC/etc/nginx/sites-available/salon4.hairbxl.be"
mkdir -p "$BAC/srv/sites/salon4/current"
# rappl.be répond avant (le relevé se fait au tout début), puis meurt : on
# simule en le tuant à partir du deuxième appel.
cat >"$BAC/bin/curl" <<'EOF'
#!/usr/bin/env bash
cible="${*: -1}"
compteur="$RACINE_TEST/compteur-$(echo "$cible" | tr -c 'a-z0-9' '-')"
n=$(( $(cat "$compteur" 2>/dev/null || echo 0) + 1 ))
echo "$n" >"$compteur"
if [[ "$cible" == *rappl.be* && "$n" -gt 1 ]]; then echo -n "000"; exit 0; fi
echo -n "200"
EOF
chmod +x "$BAC/bin/curl"
code="$(lancer salon4 salon4.hairbxl.be)"
verifier "sortie en échec" 1 "$code"
verifier "retour arrière effectué" "oui" \
	"$([[ ! -e "$BAC/etc/nginx/sites-enabled/salon4.hairbxl.be" ]] && echo oui || echo non)"
verifier "message explicite" "oui" \
	"$(grep -q 'ne répondent plus' "$BAC/sortie" && echo oui || echo non)"

echo
printf '%s réussite(s), %s échec(s)\n' "$reussites" "$echecs"
[[ "$echecs" -eq 0 ]]
