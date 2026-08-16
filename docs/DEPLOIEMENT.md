# Mise en ligne sur le VPS — procédure

Ce document se suit **dans l'ordre**, de haut en bas. Il est écrit pour
quelqu'un — ou une IA — qui n'a pas participé au développement.

Chaque étape se termine par un **« Vérifier »**. Tant que la vérification
échoue, ne pas passer à la suivante : les étapes suivantes en dépendent, et un
problème diagnostiqué trois étapes plus tard coûte dix fois plus cher.

Les étapes marquées **⛔ STOP** demandent une information ou une décision
humaine. Ne rien inventer à ces endroits-là : une clé d'API fabriquée, un mot
de passe deviné ou un nom de domaine supposé produisent une panne silencieuse
qui se découvre en clientèle.

⚠️ **Si le serveur héberge déjà des sites, lire d'abord le §0 bis.** Plusieurs
étapes de cette procédure sont écrites pour une machine neuve et casseraient
l'existant telles quelles.

Rien de tout ceci n'a jamais tourné sur une vraie machine. Le code est testé
(138 tests, types vérifiés), les fichiers de configuration sont validés, mais
la première exécution réelle est celle-ci. **S'attendre à des surprises est
normal** ; les noter au fur et à mesure dans la section « Journal » en bas.

---

## 0. Ce qu'il faut avoir sous la main

⛔ **STOP — à obtenir de l'exploitant avant de commencer.**

| Élément | Où l'obtenir | Sans lui |
|---|---|---|
| VPS Debian 12 ou Ubuntu 24.04, accès root | Hetzner, Scaleway, OVH — 4 à 8 €/mois suffisent | rien n'est possible |
| Adresse IPv4 du serveur | panneau du fournisseur | rien n'est possible |
| Nom de domaine de service | registrar (Gandi, OVH, Namecheap) | ni API ni administration |
| Accès à la zone DNS de ce domaine | registrar | aucun certificat |
| Clé d'API Resend | resend.com, après vérification du domaine d'envoi | aucun courriel ne part |
| Clé secrète Stripe + secret de webhook | dashboard.stripe.com | aucun prélèvement |
| Clé SSH publique de l'exploitant | son poste, `~/.ssh/id_ed25519.pub` | plus d'accès après durcissement |

**Dimensionnement.** Les sites clients sont des fichiers statiques : ils ne
consomment presque rien. Ce qui consomme, c'est Postgres et les deux services
Node. 2 vCPU / 4 Go tiennent très largement trente clients. Commencer petit,
le fournisseur permet d'agrandir plus tard.

**Trois sous-domaines de service** à prévoir sur le domaine de service — par
exemple `api.hair.be`, `admin.hair.be`, et un pour la démonstration. Ils sont
distincts des domaines clients (voir §7).

---

## 0 bis. Serveur qui héberge déjà quelque chose

Cette procédure ajoute un projet à une machine. Elle ne doit **rien** casser de
ce qui tourne déjà. Trois étapes sont dangereuses telles quelles, et une
quatrième mérite attention.

### Faire l'état des lieux d'abord

```bash
ss -lntp                      # qui écoute quoi
systemctl list-units --type=service --state=running | head -40
docker ps 2>/dev/null         # conteneurs existants
ufw status verbose            # pare-feu : actif ? quelles règles ?
ls /etc/caddy/ /etc/nginx/sites-enabled/ /etc/apache2/sites-enabled/ 2>/dev/null
```

`infra/setup-vps.sh` commence lui aussi par cet état des lieux et l'affiche
avant de toucher à quoi que ce soit. **Le lire avant de continuer.**

### Les quatre points de vigilance

**1. Un autre serveur web sur les ports 80 et 443.** Deux serveurs web ne
partagent pas un port. Si nginx ou Apache tourne, `setup-vps.sh` **s'arrête de
lui-même** et expose les trois issues possibles :

- garder le serveur en place et lui faire servir les sites de ce projet — ils
  sont purement statiques, un bloc par domaine avec
  `root /srv/sites/<slug>/current` suffit. C'est le chemin le plus sûr sur une
  machine en production ; les fichiers produits par `pnpm caddy` ne servent
  alors pas, il faut écrire leur équivalent ;
- migrer l'existant vers Caddy — propre à terme, mais cela veut dire
  reconfigurer et retester tous les sites déjà en ligne, ce qui n'est pas un
  travail de soir de mise en ligne ;
- prendre un second VPS pour ce projet. 4 à 8 €/mois, aucun risque pour
  l'existant, sauvegardes isolées. ⛔ **C'est la recommandation par défaut si
  les sites déjà en place rapportent de l'argent.**

**2. Le pare-feu.** Activer UFW avec seulement 22, 80 et 443 ouverts coupe tout
le reste — messagerie, panneau d'administration, port applicatif exotique —
sans prévenir. `setup-vps.sh` **ajoute les règles mais n'active plus rien** par
défaut. Si le pare-feu est déjà actif, il n'y touche pas.

**3. Le `Caddyfile` existant.** Le §5 dit de copier `infra/Caddyfile` vers
`/etc/caddy/Caddyfile`. ⛔ **Si ce fichier existe et contient déjà des sites,
ne pas l'écraser.** Voir la variante au §5.

**4. Les ports 3000, 4000 et 5432.** L'API, l'interface d'administration et la
base s'y attendent. S'ils sont pris, les changer dans `infra/docker-compose.yml`
et dans `infra/api.caddy` / `infra/admin.caddy` — les trois doivent rester
cohérents.

### Ce qui ne pose aucun problème

Docker (les conteneurs de ce projet sont regroupés sous le nom `bxl`),
Postgres en conteneur (il n'expose rien à l'extérieur, même si un Postgres
tourne déjà sur la machine), `/srv/sites`, et l'utilisateur `deploy`.

---

## 1. Commander et joindre le serveur

```bash
# Depuis le poste de l'exploitant. Remplacer par l'IP réelle.
ssh root@<IP>
```

**Vérifier :** `cat /etc/os-release` affiche Debian 12 ou Ubuntu 24.04. Si
c'est une autre distribution, s'arrêter et le signaler : `setup-vps.sh` est
écrit pour APT et pour ces deux versions.

---

## 2. Socle du serveur

Copier le script d'installation sur le serveur et le lancer.

```bash
# Depuis le poste, à la racine du dépôt :
scp infra/setup-vps.sh root@<IP>:/root/

# Sur le serveur :
ACME_EMAIL=<adresse de l'exploitant> bash /root/setup-vps.sh
```

Le script installe : utilisateur `deploy`, Caddy, Docker, l'arborescence
`/srv/sites`, un pare-feu SSH/HTTP/HTTPS, et les mises à jour de sécurité
automatiques. Il ne demande aucun secret.

**Vérifier :**

```bash
id deploy                    # l'utilisateur existe, groupes : deploy, docker
caddy version                # v2.x
docker --version             # 24.x ou plus
docker compose version       # v2.x — « compose » sans tiret
ufw status                   # actif, 22/80/443 ouverts, le reste fermé
```

---

## 3. Accès et durcissement

```bash
# Sur le serveur, déposer la clé publique de l'exploitant :
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "<contenu de id_ed25519.pub>" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

⛔ **STOP.** Vérifier que `ssh deploy@<IP>` fonctionne **depuis une autre
fenêtre, sans fermer la session root en cours**. Se verrouiller dehors est
l'erreur classique de cette étape, et elle se répare au prix d'une console de
secours chez le fournisseur.

⛔ **Sur un serveur déjà en service, le durcissement SSH qui suit est
facultatif — et à ne faire qu'en connaissance de cause.** Couper la connexion
par mot de passe casse tout ce qui s'y appuie encore : un script de sauvegarde,
un client SFTP, un outil de déploiement d'un autre projet. Vérifier d'abord, et
demander à l'exploitant :

```bash
grep -E '^(PermitRootLogin|PasswordAuthentication)' /etc/ssh/sshd_config
last -20                      # qui se connecte, et comment
```

Si c'est déjà durci, il n'y a rien à faire. Sinon, une fois la connexion
`deploy` confirmée :

```bash
# Sur le serveur, en root :
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.avant-bxl
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sshd -t && systemctl reload ssh    # « reload » : les sessions ouvertes survivent
```

**Vérifier :** `ssh deploy@<IP>` fonctionne toujours ; `ssh root@<IP>` est
refusé.

---

## 4. DNS

⛔ **STOP — demander à l'exploitant de créer ces enregistrements**, ou lui
donner la liste exacte s'il le fait lui-même. Personne d'autre n'a accès à sa
zone DNS.

| Type | Nom | Valeur | Pour |
|---|---|---|---|
| A | `api` | `<IP>` | l'API |
| A | `admin` | `<IP>` | l'interface d'administration |
| A | `demo` | `<IP>` | le site de démonstration |
| A | `*` | `<IP>` | **les sous-domaines clients** — voir §7 |

L'enregistrement générique `*` est important dans ce modèle : la plupart des
clients vivent sur un sous-domaine (`kevincoiffure.hair.be`), et sans lui il
faudrait retourner chez le registrar à chaque signature. Avec lui, un nouveau
client ne demande plus aucune action DNS.

**Vérifier**, depuis n'importe où, avant d'aller plus loin :

```bash
dig +short api.<domaine>     # doit répondre l'IP du serveur
dig +short admin.<domaine>
```

La propagation prend de quelques minutes à quelques heures. **Ne pas lancer
Caddy tant que le DNS ne répond pas** : Let's Encrypt limite le nombre
d'échecs, et cinq tentatives ratées imposent une heure d'attente.

---

## 5. Configuration de Caddy

**Serveur neuf, ou `/etc/caddy/Caddyfile` encore par défaut :**

```bash
# Depuis le poste :
scp infra/Caddyfile root@<IP>:/etc/caddy/Caddyfile
```

⛔ **Serveur qui sert déjà des sites avec Caddy — NE PAS écraser.** Sauvegarder
d'abord, puis fusionner à la main :

```bash
# Sur le serveur :
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.avant-bxl
```

Il faut alors reprendre trois choses du `infra/Caddyfile` de ce dépôt, sans
toucher au reste :

1. le bloc global `{ ... }` — n'en garder **qu'un seul** dans le fichier ; si
   un `email` y est déjà défini, laisser celui qui existe ;
2. le fragment `(commun)` en entier — c'est lui qui porte la compression, les
   en-têtes de sécurité, la politique de cache et la page 404 ;
3. la dernière ligne, `import /etc/caddy/sites/*.caddy`, qui charge les blocs
   des clients.

Les blocs de sites déjà présents restent inchangés.

**Puis, dans les deux cas :**

```bash
# Sur le serveur :
systemctl daemon-reload
caddy validate --config /etc/caddy/Caddyfile   # doit répondre « Valid configuration »
systemctl reload caddy                          # « reload », jamais « restart » :
                                                # aucune coupure pour les sites en place
```

**Vérifier :** `systemctl status caddy` est `active (running)`, et
`journalctl -u caddy -n 30` ne montre aucune erreur.

À ce stade aucun site **de ce projet** n'est encore servi : le `Caddyfile`
importe `/etc/caddy/sites/*.caddy`, qui est vide. C'est normal.

⛔ **Sur un serveur partagé, vérifier ici que les sites existants répondent
toujours** avant d'aller plus loin :

```bash
curl -sI https://<un site déjà en ligne> | head -1   # doit rester 200
```

Si quelque chose est cassé, revenir en arrière tout de suite :
`cp /etc/caddy/Caddyfile.avant-bxl /etc/caddy/Caddyfile && systemctl reload caddy`.

---

## 6. Base de données, API et administration

### 6.1 Cloner le dépôt sur le serveur

L'interface d'administration écrit dans ce clone, commite et pousse : git reste
la source de vérité du contenu.

```bash
# Sur le serveur, en tant que deploy :
sudo -iu deploy
ssh-keygen -t ed25519 -C "vps-bxl" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

⛔ **STOP.** Cette clé publique doit être ajoutée sur GitHub comme *deploy key
avec accès en écriture*, sur le dépôt `NoppeHugo/WebsiteBXL`. Sans écriture,
l'interface d'administration pourra modifier les fichiers mais pas les
enregistrer.

```bash
# Toujours en tant que deploy :
# La branche de travail est aussi la branche par défaut du dépôt : un clone
# simple récupère bien tout. La nommer explicitement évite toute surprise si
# une autre branche par défaut apparaissait un jour.
git clone -b claude/brussels-showcase-sites-strategy-821fen \
  git@github.com:NoppeHugo/WebsiteBXL.git /srv/repo
cd /srv/repo
git config user.email "admin@<domaine>"
git config user.name "Interface BXL"
```

**Vérifier :** `git -C /srv/repo push --dry-run` réussit.

### 6.2 Renseigner les secrets

```bash
cd /srv/repo
cp .env.example .env
```

⛔ **STOP — remplir `.env` avec les vraies valeurs.** Ne pas inventer :

| Variable | Valeur |
|---|---|
| `POSTGRES_PASSWORD` | à générer : `openssl rand -base64 32` |
| `SESSION_SECRET` | à générer : `openssl rand -base64 48` |
| `EMAIL_DRIVER` | `resend` ou `smtp` — `log` est refusé au démarrage en production |
| `RESEND_API_KEY` | fournie par l'exploitant, si `EMAIL_DRIVER=resend` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | si `EMAIL_DRIVER=smtp`. Gmail : `smtp.gmail.com`, port 465, et un **mot de passe d'application** — le mot de passe du compte est refusé |
| `MAIL_FROM` | ex. `Réservations <no-reply@<domaine>>`. Avec Resend, le domaine doit être vérifié. **Avec Gmail, l'expéditeur est réécrit** avec l'adresse du compte, sauf alias vérifié dans Gmail |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | fournies par l'exploitant |
| `PUBLIC_API_URL` | `https://api.<domaine>` |
| `PUBLIC_ADMIN_URL` | `https://admin.<domaine>` |
| `REPO_PATH` | `/srv/repo` |
| `SSH_KEY_PATH` | `/home/deploy/.ssh/id_ed25519` |
| `DEPLOY_HOST` | `deploy@<IP>` |

```bash
chmod 600 .env
```

**Docker Compose lit le `.env` du dossier qui contient le `docker-compose.yml`**,
pas celui de la racine du dépôt. Sans le lien ci-dessous, le fichier écrit à
l'instant n'est jamais lu, et Compose s'arrête sur
`required variable MAIL_FROM is missing a value` alors que la valeur y est bien.
Un lien plutôt qu'une copie : un seul fichier de secrets à tenir à jour.

```bash
ln -s ../.env /srv/repo/infra/.env
```

### 6.3 Démarrer les services

```bash
cd /srv/repo/infra
docker compose config >/dev/null   # valide la syntaxe et les variables
docker compose up -d --build       # la première construction prend 3 à 10 minutes
```

**Vérifier :**

```bash
docker compose ps                  # db, api et admin en « running » / « healthy »
curl -s localhost:3000/health      # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' localhost:4000/agenda   # 303 (redirection vers la connexion)
docker compose logs api | tail -30
```

Les migrations de base sont appliquées automatiquement au démarrage de l'API.
`docker compose logs api` doit le montrer, sans erreur.

Si l'API refuse de démarrer, lire le message : la configuration est validée au
lancement et **refuse volontairement** `EMAIL_DRIVER=log` en production. C'est
délibéré — un courriel qui ne part pas est une réservation perdue.

### 6.4 Exposer l'API et l'administration

```bash
# Depuis le poste, après avoir remplacé « exemple.be » par le vrai domaine
# dans les deux fichiers :
scp infra/api.caddy infra/admin.caddy root@<IP>:/etc/caddy/sites/

# Sur le serveur :
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

**Vérifier depuis l'extérieur :**

```bash
curl -s https://api.<domaine>/health     # {"ok":true}, en HTTPS, sans avertissement
```

Le certificat est obtenu au premier accès. S'il échoue, la cause est presque
toujours le DNS (§4) ou le port 80 fermé.

### 6.5 Créer le compte d'administration

```bash
cd /srv/repo/infra
docker compose exec admin node --experimental-strip-types src/cli/create-admin.ts
```

Le secret TOTP **ne s'affiche qu'une fois**. Le faire scanner immédiatement par
l'exploitant dans son application d'authentification.

**Vérifier :** connexion réussie sur `https://admin.<domaine>` avec adresse,
mot de passe et code à six chiffres.

---

## 7. Premier site en ligne

### 7.0 Le premier site à mettre en ligne est la démonstration

Le dépôt ne contient aujourd'hui **qu'un seul client** : `demo-barbier`, le
site de démonstration. C'est lui qu'il faut mettre en ligne en premier — c'est
l'outil de vente, montré sur un téléphone en porte-à-porte.

Dans son état actuel il **n'est pas déployable**, et c'est voulu : son domaine
est `demo-barbier.local` et son statut est `draft`. `./scripts/deploy.sh`
refuse tout site qui n'est pas en `live`.

⛔ **STOP — demander le vrai sous-domaine de démonstration à l'exploitant**
(par exemple `demo.hair.be`), puis modifier `clients/demo-barbier/site.json` :

```json
{
  "domain": "demo.hair.be",
  "status": "live",
  "demo": true
}
```

**Ne pas retirer `"demo": true`.** C'est ce drapeau qui affiche le bandeau
« site de démonstration — commerce fictif » et qui interdit l'indexation. Un
site de démonstration référencé par Google concurrencerait les vrais clients
sur les mêmes recherches. `pnpm check` le rappelle par un avertissement — cet
avertissement est normal ici.

Committer et pousser ce changement : le serveur travaille depuis le dépôt.

**Vérifier :** `pnpm check` ne signale aucune **erreur** (les avertissements
sur la fiche Google et sur la démonstration en ligne sont attendus).

### 7.1 Choisir son adresse

Règle commerciale, détaillée en §3.10 du README : **sous-domaine par défaut**,
domaine propre à partir du palier Pro.

```json
// Essentiel — le cas courant
{ "domain": "kevincoiffure.hair.be", "aliases": [] }

// Pro, ou Essentiel avec l'option domaine
{
  "domain": "kevincoiffure.be",
  "aliases": ["kevincoiffure.hair.be", "www.kevincoiffure.be"]
}
```

`domain` est l'adresse canonique — celle qui figure dans les balises de la page
et dans les données structurées. Les `aliases` redirigent vers elle de façon
permanente, en conservant le chemin.

**Quand un client passe au domaine propre**, ne pas supprimer l'ancien
sous-domaine : le déplacer dans `aliases`. Les clients du salon l'ont peut-être
en signet, et la redirection transfère le référencement au lieu de le
disperser. Puis reconstruire, redéployer, et régénérer le bloc Caddy.

### 7.2 Enregistrer le commerce et construire

```bash
# Sur le poste, à la racine du dépôt :
pnpm tenant <slug> --email <adresse du salon>
# → écrit tenantId dans site.json, et l'origine du site en base

pnpm check                     # aucune erreur bloquante
PUBLIC_API_URL=https://api.<domaine> pnpm build <slug>
```

⚠️ `PUBLIC_API_URL` est lue **au moment du build** et figée dans le HTML.
Absente, le site se construit sans formulaire ni réservation, sans erreur
visible. `pnpm build` avertit désormais dans ce cas — lire ses messages.

### 7.3 Déployer

```bash
# Le site doit être en statut « live » dans site.json, sans quoi le script refuse.
./scripts/deploy.sh <slug>
```

Le script écrit une nouvelle release puis bascule un lien symbolique : la
bascule est atomique, et le retour arrière consiste à refaire pointer le lien
sur la release précédente.

### 7.4 Publier le bloc Caddy

```bash
pnpm caddy <slug> --out ./out
scp ./out/<slug>.caddy root@<IP>:/etc/caddy/sites/
ssh root@<IP> 'caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy'
```

**Vérifier :** `https://<domaine du client>` s'affiche en HTTPS, dans les
langues activées. Si le client a des alias, vérifier aussi qu'ils redirigent :

```bash
curl -sI https://<alias> | head -3   # 301, avec « location: https://<domaine> »
```

> **Piste d'amélioration, à décider avec l'exploitant.** Tant que les clients
> vivent sur des sous-domaines, ces quatre commandes pourraient disparaître :
> un unique bloc `*.hair.be` servant `/srv/sites/{labels.2}/current` mettrait
> un nouveau site en ligne au seul déploiement de ses fichiers, sans toucher au
> serveur. Cela demande un certificat générique — donc soit une compilation de
> Caddy avec le module DNS du registrar, soit l'émission à la demande, qui
> exige elle-même un point de contrôle pour éviter qu'un inconnu pointant son
> DNS vers l'IP ne déclenche des demandes de certificat. Ni l'un ni l'autre
> n'est fait aujourd'hui : ne pas improviser ici.

---

## 8. Sauvegardes

Les sites se reconstruisent depuis git ; **la base, non**. Elle contient les
rendez-vous, les messages et l'audience : sa perte est irréversible.

```bash
# Sur le serveur, en tant que deploy :
mkdir -p /srv/repo/infra/backups
cat >/home/deploy/sauvegarde.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /srv/repo/infra
docker compose exec -T db pg_dump -U bxl bxl | gzip \
  > "backups/bxl-$(date -u +%Y%m%d-%H%M%S).sql.gz"
find backups -name 'bxl-*.sql.gz' -mtime +30 -delete
EOF
chmod +x /home/deploy/sauvegarde.sh
( crontab -l 2>/dev/null; echo "17 3 * * * /home/deploy/sauvegarde.sh" ) | crontab -
```

**Vérifier, et c'est le point important :**

```bash
/home/deploy/sauvegarde.sh                    # produit un fichier
ls -la /srv/repo/infra/backups/               # non vide, quelques dizaines de Ko

# Restauration à blanc, dans une base jetable — une sauvegarde jamais
# restaurée n'est pas une sauvegarde.
cd /srv/repo/infra
docker compose exec -T db createdb -U bxl essai_restauration
gunzip -c backups/$(ls -t backups | head -1) | \
  docker compose exec -T db psql -U bxl -d essai_restauration >/dev/null
docker compose exec -T db psql -U bxl -d essai_restauration \
  -c "select count(*) from appointments"     # doit répondre sans erreur
docker compose exec -T db dropdb -U bxl essai_restauration
```

⛔ **STOP.** Ces sauvegardes vivent sur le même disque que la base. Un disque
perdu les emporte avec elle. Prévoir une copie hors du serveur — `rclone` vers
un stockage objet, ou une simple tâche `rsync` depuis un autre poste. À décider
avec l'exploitant.

---

## 9. Ce qui n'a jamais été essayé, et qu'il faut essayer ici

Cette liste est le vrai objet de cette première mise en ligne. Cocher chaque
point **en vérifiant le résultat réel**, pas en supposant.

- [ ] Les images Docker se construisent sur le serveur.
- [ ] Un courriel de confirmation de rendez-vous arrive réellement, et pas dans
      les indésirables. Réserver un créneau depuis le site, avec une vraie
      adresse.
- [ ] Le courriel au salon arrive aussi.
- [ ] Le lien d'annulation du courriel fonctionne, et le créneau redevient
      réservable.
- [ ] Le rappel part bien la veille. Pour le forcer sans attendre : créer un
      rendez-vous à 24 h et relancer l'API.
- [ ] Un formulaire de contact envoyé **avec JavaScript désactivé** ramène sur
      le site avec le bandeau de confirmation.
- [ ] La mesure d'audience enregistre depuis un vrai navigateur, sur le domaine
      du client, avec l'API sur un autre domaine.
      `select count(*) from page_events` doit augmenter.
- [ ] Le rapport mensuel part. Pour l'essayer sans attendre le 2 du mois,
      utiliser le bouton de renvoi dans l'interface d'administration.
- [ ] Stripe : créer un abonnement d'essai, vérifier que le webhook arrive et
      que la page de facturation affiche la bonne échéance.
- [ ] Le certificat HTTPS se renouvelle. Rien à faire, mais noter la date
      d'expiration et revenir la vérifier.
- [ ] La restauration de sauvegarde (§8).

---

## 10. Quand quelque chose échoue

| Symptôme | Première chose à regarder |
|---|---|
| Pas de certificat HTTPS | `dig +short <domaine>` pointe-t-il l'IP ? Port 80 ouvert ? `journalctl -u caddy -n 50` |
| Site en 404 | `ls -la /srv/sites/<slug>/current` — le lien existe-t-il et pointe-t-il une release non vide ? |
| L'API ne démarre pas | `docker compose logs api` — la configuration est validée au lancement, le message dit ce qui manque |
| Formulaire refusé, erreur d'origine | l'origine enregistrée en base doit correspondre exactement au domaine du site, `www` compris. `pnpm tenant <slug>` la met à jour |
| Aucun courriel | domaine vérifié chez Resend ? `EMAIL_DRIVER=resend` ? `docker compose logs api \| grep -i mail` |
| Aucune donnée d'audience | ouvrir la console du navigateur sur le site : une erreur d'origine y apparaîtrait |
| Site à moitié cassé après déploiement | revenir à la release précédente : `ln -sfn /srv/sites/<slug>/releases/<précédente> /srv/sites/<slug>/current` |

**Règle générale :** ne pas contourner un garde-fou pour faire passer une
étape. Ils refusent tous quelque chose de précis, et pour une raison écrite
dans le code juste à côté. Un déploiement forcé malgré un statut « draft », ou
un `EMAIL_DRIVER=log` remis en production, transforme un échec bruyant en panne
silencieuse chez un client.

---

## Journal

À remplir pendant l'exécution : ce qui a divergé de cette procédure, ce qui a
manqué, ce qui a pris plus de temps que prévu. C'est ce qui rendra la deuxième
mise en ligne rapide.

| Date | Étape | Ce qui s'est passé | Correction apportée |
|---|---|---|---|
| 2026-08-16 | 0 bis | État des lieux du VPS `vps-1bd44788` : **nginx actif** sur 80/443 avec 4 sites en production (collierscolliersmaison.be, eventmemories.be, noppevisuals.be, rappl.be), 12 conteneurs Docker répartis sur 6 projets, UFW **déjà actif**. Baseline relevée avant toute action : les 4 sites répondent HTTP 200. | Aucune modification. `setup-vps.sh` s'arrêterait de lui-même (conflit nginx) ; `PARTAGE_ACCEPTE=oui` **non** utilisé. Décision remontée à l'exploitant. |
| 2026-08-16 | 0 bis, point 4 | Conflit de port : l'API attend `127.0.0.1:3000`, déjà pris par `eventpartyvideo-backend-1`. 4000 (admin) est libre. 5432 sans objet — tous les Postgres sont en conteneur, sans publication sur l'hôte. | À corriger dans `infra/docker-compose.yml` + le bloc de l'API avant tout démarrage. Port de remplacement proposé : 3020. |
| 2026-08-16 | 0 bis | `sudo` exige un mot de passe pour l'utilisateur `hugo` : aucune étape root n'est automatisable depuis cette session (socle, nginx, certbot, création de `deploy`). | Chaque commande root est préparée puis lancée par l'exploitant. |
| 2026-08-16 | 0 bis | **Décision de l'exploitant : option 1** — garder nginx et lui faire servir les sites du projet. Motif : la machine est déjà outillée pour ça (nginx + certbot, 4 sites dont un reverse-proxy identique à celui dont l'API a besoin), et `nginx -t` avant chaque `reload` rejette une config invalide sans toucher aux sites en ligne. | Contrepartie acceptée : plus d'émission automatique de certificats à la Caddy — chaque nouveau domaine client demandera un passage de certbot. |
| 2026-08-16 | 1 | Ubuntu 24.04.3 LTS, 6 vCPU / 11 Gio / 48 Gio libres. Conforme. IP publique relevée (et non supposée) : `57.129.139.107`, confirmée par `ip addr` et par une vue extérieure. | — |
| 2026-08-16 | 2 | `setup-vps.sh` inutilisable tel quel (il installe Caddy et s'arrête sur nginx). | Écrit `infra/setup-vps-nginx.sh` : même socle sans Caddy, sans fail2ban (durcissement non demandé, risque de bannir un accès légitime sur une machine en service), sans activation du pare-feu. Idempotent, et se termine par un contrôle des 4 sites en production. |
| 2026-08-16 | 2 | Node de l'hôte en v18 alors que le dépôt exige `>=22`, et pnpm absent. | Node système **non** touché (d'autres projets pourraient s'en servir) : pnpm/Node 22 à installer pour le seul utilisateur de déploiement. |
| 2026-08-16 | 3 | Durcissement SSH : `PasswordAuthentication no` déjà en place. | Rien à faire, conformément au §3. `sshd_config` non modifié. |
| 2026-08-16 | 4 | Domaine de service fourni : `hairbxl.be` (zone chez Hostinger, NS `apollo`/`athena.dns-parking.com`). La zone existe et répond en interrogation directe des NS, **mais le domaine n'est pas encore délégué au registre `.be`** : `dig +trace` ne renvoie que des NSEC3. Aucun certificat n'est demandable tant que ce n'est pas propagé. | Attente de la délégation. Enregistrements A à créer par l'exploitant pendant ce temps ; le socle (§2) ne dépend pas du DNS et peut se faire en parallèle. |
| 2026-08-16 | 2 | Socle passé. `deploy` créé (groupes `deploy`, `users`, `docker`), `/srv/sites` en place, fragment nginx déposé, règles UFW confirmées sans activation. `nginx -t` valide et les 4 sites toujours en 200. Avertissement `protocol options redefined for [::]:443` sur `rappl.be:15` : **préexistant**, sans effet, non corrigé. | Sauvegarde `/root/nginx-avant-bxl.tgz` faite avant toute chose. |
| 2026-08-16 | 6.1 | **Dette assumée : pas de deploy key GitHub pour l'instant** (choix de l'exploitant). `/srv/repo` est donc peuplé depuis le clone local, ce qui n'en a pas besoin. | ⚠️ Tant que la clé n'est pas déclarée sur GitHub **avec accès en écriture**, la console d'administration modifiera les fichiers clients **sans pouvoir les enregistrer** — aucune erreur visible, travail perdu au déploiement suivant. À vérifier par `git -C /srv/repo push --dry-run` avant tout usage réel de la console. |
| 2026-08-16 | 6.1 | `scripts/deploy.sh` passe par `ssh $DEPLOY_HOST` + `rsync` même vers la machine locale. | Clé SSH **locale** `deploy` → `deploy@localhost` (sans rapport avec GitHub, rien d'exposé). `DEPLOY_HOST=deploy@localhost`. |
| 2026-08-16 | 6.2 | L'exploitant ne prend pas Resend et veut passer par une adresse Gmail. Le projet ne connaissait que `log` et `resend`. | Driver `smtp` ajouté à `mail-transport.ts` (nodemailer, import dynamique, connexion réutilisée), variables `SMTP_*` dans les deux configurations, validation au démarrage, 5 tests. `EMAIL_DRIVER` et `RESEND_API_KEY` ne sont plus exigés par Compose : c'est l'application qui vérifie que le driver choisi a ce qu'il lui faut. 143 tests, types vérifiés. |
| 2026-08-16 | 6.2 | ⚠️ **Limites de Gmail à connaître avant la mise en clientèle** : l'expéditeur est réécrit avec l'adresse du compte (le client verra l'adresse Gmail, sauf alias vérifié dans Gmail), plafond de 500 envois par jour, et un **mot de passe d'application** est obligatoire (validation en deux étapes requise). | Accepté pour démarrer. Bascule vers Resend possible sans réécrire quoi que ce soit — les deux drivers coexistent. |
| 2026-08-16 | 6.2 | `MAIL_FROM` non quoté dans `.env.example` : `scripts/deploy.sh` fait `source .env`, où `<` est lu comme une redirection. La lecture du fichier échoue alors **en entier**, et le déploiement s'arrête sur « DEPLOY_HOST non défini » — un message sans rapport avec la cause. | Guillemets ajoutés dans `.env.example`, et contrôle `source` ajouté avant tout démarrage. |
| 2026-08-16 | 6.3 | Compose lit le `.env` du dossier du `docker-compose.yml`, pas celui de la racine. La procédure fait écrire `/srv/repo/.env` puis lance Compose depuis `/srv/repo/infra` : le fichier n'était jamais lu, avec l'erreur trompeuse `required variable MAIL_FROM is missing a value` alors que la valeur était bien présente. | Lien `infra/.env → ../.env`, et §6.2 complété. Un lien plutôt qu'une copie : un seul fichier de secrets, pas de version oubliée qui diverge. |
| 2026-08-16 | 5 | Le §5 (Caddyfile) ne s'applique pas. | Remplacé par `infra/nginx/` : `bxl-commun.conf` (fragment `(commun)`), `api.conf.modele`, `admin.conf.modele`, `site.conf.modele` (équivalent de `pnpm caddy`). Modèles en HTTP seul — c'est certbot qui ajoute le TLS, comme pour les 4 sites déjà en place. |
