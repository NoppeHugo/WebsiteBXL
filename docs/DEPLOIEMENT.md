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

## 7 bis. Ajouter un client, en clientèle

Tout le §7 décrit la mise en ligne **à la main**, depuis un poste, avec un accès
root au serveur. C'est ce qu'il faut connaître le jour où quelque chose casse.
Ce n'est pas ce qu'on fait chez un commerçant.

Chez lui, tout passe par la console : **Clients → + Nouveau client**.

### 7 bis.1 Installation préalable, une seule fois

Poser le bloc nginx d'un client et lui obtenir un certificat demande root. La
console n'a pas root et ne doit pas l'avoir : un seul utilitaire, précis, lui
est ouvert.

```bash
# Sur le serveur, en root :
sudo bash /srv/repo/infra/installer-vhost.sh
```

Il installe `/usr/local/sbin/bxl-vhost`, le modèle de bloc nginx dans
`/usr/local/share/bxl/`, et une règle sudo autorisant `deploy` à lancer ce seul
programme sans mot de passe.

> **Pourquoi une copie hors du dépôt.** `deploy` possède `/srv/repo` en
> écriture, et la console y écrit à chaque enregistrement. Une règle sudo
> pointant vers un script du dépôt donnerait donc root à quiconque obtient la
> console : un défaut de l'interface deviendrait un défaut du serveur entier.
> La copie appartient à root ; la console peut la lancer, pas la réécrire.
>
> **À relancer après toute modification** de `infra/bxl-vhost` ou de
> `infra/nginx/site.conf.modele` : ce qui s'exécute est la copie.

**Vérifier :**

```bash
sudo -u deploy sudo -n /usr/local/sbin/bxl-vhost
# → « usage : bxl-vhost <slug> <domaine> » : le compte peut le lancer,
#   et l'utilitaire refuse un appel vide.

bash /srv/repo/infra/bxl-vhost.test.sh
# → 23 réussite(s), 0 échec(s). N'appelle rien sur le réseau et n'écrit que
#   dans un dossier temporaire : sans danger sur la machine de production.
```

Le DNS doit par ailleurs accepter n'importe quel sous-domaine du domaine de
service — un enregistrement générique `*`. C'est déjà le cas ici (§4).

### 7 bis.2 Sur place, avec le commerçant

Le formulaire ne demande que ce que le commerçant a sous la main : nom, type,
téléphone, e-mail, adresse, palier, langues, puis un style et une couleur —
choisis avec lui, c'est ce qui emporte la décision.

Environ une minute plus tard, le site est en ligne à
`https://<identifiant>.<domaine de service>`, avec son certificat.

Ce qui s'est passé pendant cette minute :

| Où | Quoi |
| --- | --- |
| Console | `site.json` et `theme.json` écrits, commerce enregistré en base, commit poussé |
| Hôte | visuels de remplacement, construction, déploiement |
| Hôte, en root | bloc nginx, certificat Let's Encrypt |

### 7 bis.3 L'état « En préparation »

Le site naît en `preview` : **visible à son adresse, refusé à Google.**

C'est le point important. Un site créé en clientèle porte encore le squelette —
« À compléter » sous le nom du commerçant, pas de prestations, pas de mentions
légales. Mis en `live` d'emblée, il deviendrait le premier résultat de
recherche pour le nom du salon, dans cet état, et le commerçant le découvrirait
des semaines plus tard.

La fiche du client affiche en permanence ce qu'il reste à remplir. Quand tout y
est, passer l'état sur **En ligne** et republier : le site entre alors dans
`sitemap.xml`, `robots.txt` s'ouvre, et la balise `noindex` disparaît.

### 7 bis.4 Ce que le squelette ne contient pas, et pourquoi

Ni prestation, ni tarif, ni horaire, ni photo du salon. Ce n'est pas un manque :
c'est un refus. Un tarif inventé qui passe en ligne engage le commerçant sur un
prix qu'il ne pratique pas ; un horaire inventé fait accepter des rendez-vous un
jour de fermeture. Aucun des deux ne produit d'erreur — seulement un client
mécontent, des semaines plus tard.

Ces informations se saisissent dans l'éditeur, pendant la visite, en les
demandant. C'est de toute façon la conversation à avoir.

La photothèque, elle, arrive garnie : dix visuels abstraits, utilisables tels
quels le temps d'organiser la séance photo.

### 7 bis.5 Passer au domaine propre

Le sous-domaine ne se supprime pas : il se déplace dans `aliases` (§7.1). Une
fois le DNS du client dirigé vers le serveur :

```bash
sudo /usr/local/sbin/bxl-vhost <slug> <domaine-du-client.be>
```

Le certificat est demandé au passage. Si le DNS ne pointe pas encore ici, la
commande échoue proprement et le laisse en HTTP — il suffit de la relancer.

### 7 bis.6 Si la création échoue en cours de route

Rien n'est défait automatiquement, et c'est délibéré : supprimer un dossier, une
ligne en base et un commit sont trois façons d'effacer autre chose que ce qu'on
croit. Le message dit où l'on s'est arrêté.

| Message | Ce qui reste à faire |
| --- | --- |
| « l'enregistrement en base a échoué » | Les fichiers existent. Vérifier que `bxl-db` tourne, puis recréer le client sous le même identifiant après avoir supprimé son dossier. |
| « l'envoi vers GitHub a échoué » | Le client existe et fonctionne. `git -C /srv/repo push` depuis le serveur. |
| « sa mise en ligne a échoué » | Le client existe. Ouvrir sa fiche et relancer « Mettre en ligne ». |
| « ÉCHEC de la demande de certificat » | Le site est servi en HTTP. Relancer `sudo /usr/local/sbin/bxl-vhost <slug> <domaine>`. |

Dans tous les cas, les sites déjà en ligne sont intacts : `bxl-vhost` relève
leur état avant d'agir, le vérifie après, et revient en arrière au moindre
écart.

---

## 7 ter. Donner au commerçant les clés de son site

Un commerçant n'a pas besoin de tout modifier. Il a besoin de **fermer**, et
tout de suite : un imprévu, une maladie, et le client qui a réservé se déplace
pour rien. C'est urgent par nature, ça ne peut pas attendre qu'on soit
joignable, et c'est ce qui use une relation client.

L'espace commerçant couvre cela, plus ce qui change de temps en temps : les
horaires, les tarifs, les photos, le texte de présentation. Rien d'autre.

### 7 ter.1 Ce que le commerçant voit, et ce qu'il ne voit pas

| Il peut | Il ne peut pas |
| --- | --- |
| Fermer une journée, une semaine, des congés | Voir les autres commerces |
| Changer ses horaires habituels | Changer son style ou ses couleurs |
| Ajouter, modifier, retirer une prestation | Mettre son site hors ligne |
| Envoyer des photos, choisir la couverture | Toucher au domaine, au palier, aux mentions légales |
| Réécrire sa présentation, ses coordonnées | Accéder à la console d'exploitation |
| Voir ses rendez-vous et les annuler | Modifier ses traductions |
| Lire les messages reçus | |

**Enregistrer publie.** Il n'y a pas de bouton « mettre en ligne » séparé : lui
demander de comprendre qu'un enregistrement ne change rien au site public,
c'est garantir qu'un jour il fermera sans que le site le dise.

L'ordre est celui-ci, et il compte : **la base d'abord, le site ensuite.** La
base commande la réservation ; dès qu'elle est à jour, plus aucun rendez-vous
n'est accepté sur un créneau fermé. Si la reconstruction du site échoue
ensuite, le site affiche encore l'ancien horaire — c'est fâcheux, mais personne
ne peut réserver ce jour-là. L'ordre inverse aurait produit exactement la panne
qu'on cherche à éviter.

### 7 ter.2 Installation, une seule fois

L'espace est servi par la **même application** que la console, sur un domaine
distinct. Un domaine par usage : l'adresse remise au coiffeur ne doit jamais
mener à la console qui gouverne les trente sites.

```bash
# Sur le serveur, en root :
sudo bash /home/hugo/go18.sh
```

Le script renseigne `PORTAL_HOST`, pose le bloc nginx du portail, demande son
certificat, applique la migration 007 et reconstruit les deux conteneurs.

⛔ **STOP — choisir le sous-domaine du portail avec l'exploitant** avant de
lancer, s'il ne veut pas `mon.<domaine de service>` :

```bash
PORTAIL=espace.hairbxl.be sudo -E bash /home/hugo/go18.sh
```

**Vérifier :** `https://<portail>/login` répond 200, et `https://<portail>/`
répond 404 pour un compte d'exploitation connecté.

### 7 ter.3 Ouvrir l'accès d'un commerçant

Console → **Accès des commerçants** → saisir son adresse e-mail → *Ouvrir
l'accès*.

Un mot de passe est tiré au sort et **affiché une seule fois** : quatre mots
courants séparés de tirets, faciles à dicter au téléphone. Le noter tout de
suite, ou le lire au commerçant pendant qu'il est là.

Il est obligé de le remplacer à sa première connexion : tant qu'il ne l'a pas
fait, aucune autre page ne s'ouvre. Un mot de passe dicté au comptoir a été
entendu par au moins deux personnes.

**Retirer un accès** le supprime immédiatement : le compte est relu en base à
chaque page, la session du commerçant meurt donc à sa requête suivante — pas à
l'expiration de son jeton douze heures plus tard.

### 7 ter.4 Ce qui empêche un salon de voir celui d'un autre

Trois barrières indépendantes, et chacune suffirait seule :

1. **Le rôle.** `admin_users.tenant_slug` vide désigne l'exploitant, renseigné
   un commerçant. Un commerçant n'atteint que `/espace`.
2. **Le nom d'hôte.** Le portail ne sert que l'espace ; la console refuse
   `/espace`.
3. **L'absence d'identifiant dans les URL.** Aucune page de l'espace ne prend
   de `slug` : il vient de la session. Il n'y a rien à falsifier, parce qu'il
   n'y a rien à écrire.

Les lectures et l'annulation de rendez-vous portent le `slug` **dans la clause
`where`**, pas dans une vérification préalable : un identifiant appartenant à un
autre salon ne trouve simplement aucune ligne.

### 7 ter.5 Ce qui reste à l'exploitant

Le style et les couleurs, les traductions, les mentions légales, le domaine, le
palier, la mise hors ligne, et la création des clients. C'est volontaire : ce
sont des décisions qui engagent, ou qui se paient — et un commerçant qui
change son style tous les mois n'a plus d'identité.

---

## 7 quater. Les métiers

Le projet ne fait plus seulement des sites de coiffeur. Un **métier** décide du
vocabulaire du site, des sections qu'il affiche, des styles qu'on propose, des
visuels de remplacement et des pages de l'espace commerçant.

Il n'y a **pas de champ « métier »** : il se déduit de `business.type`, qui
existe déjà et qui part dans les données lues par Google. Deux champs pour la
même idée finiraient par se contredire — un fichier disant « fleuriste » d'un
côté et `HairSalon` de l'autre, sans que rien ne le signale.

| Métier | Types couverts | Commande | Styles |
| --- | --- | --- | --- |
| `soins` | salon de coiffure, barbier, institut | rendez-vous | Maison, Atelier, Studio, Signature, Nuit |
| `fleuriste` | fleuriste | demande de commande | Serre, Nature morte, Marché, Herbier |
| `commerce` | boulangerie, autre | aucune | les cinq de `soins` |

Tout est dans `packages/schema/src/metiers.ts`.

### 7 quater.1 Ce qu'un fleuriste a et qu'un coiffeur n'a pas

Ce ne sont pas les mêmes sections recolorées — ce sont les questions que se
pose son client :

- **Occasions.** Personne ne cherche « bouquet rond de saison » : on cherche
  des fleurs *pour* un mariage, *pour* une naissance. C'est l'entrée
  principale du site, avant la carte des compositions.
- **Fleurs de deuil**, en section à part et au ton distinct : ni prix, ni
  formulaire, un seul bouton et il appelle. C'est le segment le plus urgent
  d'un fleuriste ; on ne fait pas comparer trois formules à quelqu'un qui
  enterre son père.
- **Livraison** : où, avant quelle heure, combien. La première question de tout
  client, et celle à laquelle presque aucun site de fleuriste ne répond.
- **Abonnement floral** : le seul revenu qui revient tous les mois —
  restaurants, cabinets, halls d'accueil.
- **Demande de commande** au lieu de la réservation. Occasion, budget, date,
  livraison ou retrait, mot pour la carte. **Aucun paiement** : un fleuriste ne
  peut pas s'engager d'avance sur un bouquet dont il ignore ce que l'arrivage
  du matin lui permettra de composer. Il rappelle, s'accorde, puis compose.

### 7 quater.2 Créer un site de fleuriste

Rien de particulier : **Clients → + Nouveau client**, et choisir « Fleuriste »
dans *Type*. La grille de styles se met à jour toute seule — un fleuriste ne se
voit jamais proposer « Nuit », qui est fait pour un salon de coiffure.

L'éditeur affiche alors *Occasions*, *Fleurs de deuil*, *Abonnements* et
*Livraison*, et masque *Le déroulé*. L'espace commerçant remplace
*Mes rendez-vous* par **Mes commandes**, et *Mes tarifs* par
*Mes compositions*.

Une démonstration est fournie : `demo-fleuriste` (Fleurs Van Aken, Ixelles).

### 7 quater.3 La durée des prestations

`durationMin` est devenu **facultatif** : un bouquet n'a pas de durée. Le
schéma la rend obligatoire dès que `booking.mode` vaut `request` ou `live` —
c'est elle qui découpe les créneaux, et une durée manquante produirait un
agenda dont tous les rendez-vous se chevauchent.

Conséquence côté base : `tenant_services` ne reçoit que les prestations qui ont
une durée. C'est la table de l'agenda ; une composition florale n'a rien à y
faire.

### 7 quater.4 Ajouter un métier plus tard

Une entrée dans `METIERS`, et le reste suit. Les tests le vérifient : ils
refusent un type de commerce qui ne serait rangé dans aucun métier, un style
nommé par un métier mais inexistant, un style qu'aucun métier ne propose, et un
remplacement de vocabulaire qui ne serait pas traduit dans les trois langues.

⛔ **Une décision reste à prendre** : le domaine de service s'appelle
`hairbxl.be`. Un fleuriste dont le site de démonstration vit à
`fleurs.hairbxl.be` le remarquera. Ce n'est pas bloquant — le client passe à
son propre domaine à la signature — mais un domaine neutre serait plus vendeur
pour tous les métiers qui ne sont pas la coiffure.

---

## 7 quinquies. Dupliquer un site

Préparer un site pour un nouveau client obligeait à repartir d'un squelette
vide, alors qu'on a souvent sous la main un site abouti du même métier — mêmes
sections, même ton, mêmes prestations à un prix près.

Fiche du client → **Dupliquer ce site →**. On donne le nom du nouveau
commerce, et l'on arrive directement dans l'éditeur de la copie.

### 7 quinquies.1 La copie reste hors ligne

Elle naît en **brouillon** : aucune adresse publique, aucun bloc nginx, aucun
certificat, rien de déployé. C'est ce qui laisse tout le temps de corriger ce
qui désigne encore l'autre commerce.

Le site ne devient public qu'au moment où l'on appuie sur **Mettre en ligne**.
Ce bouton fait alors trois choses d'un coup, pour un site jamais publié :
il passe l'état en « En préparation », pose le bloc nginx et demande le
certificat, puis construit et déploie.

### 7 quinquies.2 Ce qui est repris, et ce qui ne l'est pas

| Repris | Pas repris |
| --- | --- |
| Textes, horaires, prestations | Les avis |
| Photos, équipe, déroulé | Les mentions légales |
| Sections du métier (occasions, deuil, livraison, abonnements) | Les liens Google et les réseaux sociaux |
| Le thème — style et couleurs | Les alias de domaine |

Les trois familles écartées appartiennent au commerce d'origine, et aucune
n'échouerait bruyamment si on la recopiait :

- **les avis** : les reprendre publierait des témoignages qu'aucun client de ce
  commerce-ci n'a écrits — ce n'est pas une négligence, c'est un faux ;
- **les mentions légales** portent le numéro d'entreprise et la TVA d'une autre
  société ;
- **les liens Google** partent dans les données structurées : déclarer le
  `placeId` du voisin, c'est dire à Google qu'on *est* le voisin.

L'**identifiant technique du commerce** (`tenantId`) est régénéré. C'est la
règle non négociable : c'est la clé sous laquelle l'API range les rendez-vous,
les messages et les commandes. Partagée entre deux sites, elle ne produit
aucune erreur — les deux salons reçoivent simplement le courrier l'un de
l'autre.

### 7 quinquies.3 Le téléphone et l'e-mail, eux, sont recopiés

Volontairement : ils servent de repère à la saisie, et un formulaire de contact
sans destinataire est refusé plus loin dans la chaîne.

Mais ils désignent encore l'autre commerce, et **la fiche du nouveau site le
dit en rouge** tant qu'ils n'ont pas changé :

> ⚠ Ce site utilise encore le téléphone et l'e-mail de Fleurs Van Aken.

La comparaison porte sur la valeur du numéro, pas sur son écriture :
`+32 2 111 11 11` et `02/111.11.11` sont reconnus comme le même poste. Le cas
arrive tout seul, en recopiant le numéro depuis une fiche Google qui l'écrit
dans l'autre format.

Le contrôle ne tourne que tant que le site est en brouillon ou en préparation —
c'est là que la correction est encore gratuite.

### 7 quinquies.4 Les photos

Copiées, elles aussi : la galerie et l'accueil désignent des fichiers par leur
nom, et sans elles le site ne se construirait pas. Ce sont les photos de
l'autre commerce, et c'est assumé — la copie sert de base, et elle reste hors
ligne jusqu'à ce qu'elles soient remplacées.

Conséquence pour le script d'installation : `scripts/nouveau-site.sh` ne
génère plus les visuels de remplacement que si le client n'a **aucune** image.
Ils portent des noms fixes — `hero.jpg`, `galerie-1.jpg`… — et les régénérer
aurait écrasé les photos copiées à la première mise en ligne, sans un mot.

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
| 2026-08-16 | 6.3 | `bxl-admin` redémarrait en boucle : `Cannot find package '@bxl/api'`. Son Dockerfile ne copiait ni le manifeste de l'API avant `pnpm install`, ni ses sources après — alors que `@bxl/admin` la déclare bien en dépendance (rapports, facturation, avis de rendez-vous, courriels). `--frozen-lockfile` ne signale rien : le paquet est simplement absent de l'arborescence copiée. | Deux `COPY` ajoutés. Effet de bord utile : nodemailer entre du même coup dans l'image, ce dont le driver `smtp` a besoin. Vérifié en construisant l'image avant de la déployer. |
| 2026-08-16 | 6.3 | Après correction : db, api et admin sains. 6 migrations appliquées, `/health` → `{"ok":true}`, console en 303. Stripe absent correctement détecté (abonnements désactivés, sans plantage). | — |
| 2026-08-16 | 4 | Délégation `.be` publiée en fin d'après-midi (~2 h après la création des enregistrements). `api`, `admin` et `demo` résolvent vers l'IP du VPS, wildcard compris. | — |
| 2026-08-16 | 6.4 | Exposition derrière le nginx partagé : blocs écrits sans écraser quoi que ce soit, `nginx -t` avant tout `reload`, contrôle des 4 sites avant **et** après. Aucun impact. | Retour arrière automatique prévu dans le script si un site tombait ; il n'a pas eu à servir. |
| 2026-08-16 | 6.4 | Certificats obtenus après un essai à blanc concluant (le `--dry-run` ne consomme pas le quota Let's Encrypt, contrairement aux échecs réels — 5 par heure). HTTPS opérationnel sur `api.` et `admin.`, redirection HTTP→HTTPS active, renouvellement automatique par `certbot.timer`. Expiration : 2026-11-14. | — |
| 2026-08-16 | 6.5 | Compte d'administration créé. **TOTP désactivé à la demande de l'exploitant** : `update admin_users set totp_secret = null`. Aucune modification de code — `routes/auth.ts` ignore déjà la vérification quand le secret est absent, et la colonne est nullable. | ⚠️ La console, qui peut mettre hors ligne tous les sites clients, n'est plus protégée que par un mot de passe, sur un domaine public. Réactivation : relancer `create-admin.ts` avec la même adresse. Compensation proposée et non retenue à ce jour : filtre par IP dans `infra/nginx/admin.conf.modele`, déjà prévu et commenté. |
| 2026-08-16 | 7 | Question de l'exploitant sur la confirmation des rendez-vous. Constat : il n'existe **aucune** étape de confirmation aujourd'hui (statuts `booked`/`honoured`/`no_show`/`cancelled`, pas de `pending`), et les salons **n'ont pas de compte** — `admin_users` n'a pas de colonne tenant, la console est celle de l'exploitant seul. Le salon est prévenu par courriel, l'agenda se consulte depuis la console en choisissant le client. | Le comportement « sans confirmation » demandé par défaut est donc déjà en place. **À construire plus tard, après la mise en ligne** : une confirmation manuelle activable par salon, par lien signé dans le courriel (Accepter / Refuser en un clic, sans compte), sur le modèle du `cancel_token` existant — créneau bloqué en attente, libéré automatiquement à défaut de réponse. |
| 2026-08-16 | 7 | Wildcard DNS + nginx : tout sous-domaine non configuré tombait sur le **premier** bloc HTTPS chargé, soit `admin.` par ordre alphabétique. N'importe quel nom inventé servait donc la console d'administration, avec son certificat. | Hôte par défaut `ssl_reject_handshake` (`infra/nginx/catchall-ssl.conf`). N'existerait pas avec Caddy, qui n'ouvre un hôte TLS que pour les noms qu'il connaît : contrepartie non anticipée de l'option 1. |
| 2026-08-16 | 9 | « Impossible de prendre rendez-vous » un dimanche, chez un barbier fermé le dimanche et le lundi : la bande de dates s'ouvrait sur deux cases grisées, sans aucune heure visible. L'API était hors de cause. | Le premier jour ouvert est présélectionné. **Et un défaut bien plus grave a été trouvé là** : `today` était calculé au build et figé dans la page — un site publié le 1er et consulté le 15 demandait les créneaux à partir du 1er, donc un agenda vide, sans erreur ni journal, chez tous les clients à mesure que leur publication s'éloignait. La date est désormais lue dans le navigateur, dans le fuseau du commerce. |
| 2026-08-16 | — | Console d'administration remaniée à la demande de l'exploitant : état de publication explicite (la base distinguait déjà `save` et `publish` sans que personne s'en serve), vocabulaire français, et un **éditeur de contenu** couvrant chaque zone du site — dépôt d'images par emplacement, listes réordonnables, traductions par onglets. L'éditeur JSON devient un recours. | La CSP interdisait tout script, y compris les `onsubmit` du balisage : **les confirmations de suppression ne s'affichaient jamais**, une photo partait au premier clic. `script-src 'self'` + délégation. |
| 2026-08-16 | — | Doublons signalés par l'exploitant : coordonnées, horaires et tarifs figuraient sur la fiche client **et** dans l'éditeur. | Règle établie — la fiche pour la visibilité, la publication et la bibliothèque de photos ; l'éditeur pour tout le contenu. Le nettoyage a révélé que le gestionnaire de la fiche écrivait encore des champs que son formulaire n'envoyait plus : enregistrer les réglages aurait vidé le téléphone et **fermé les sept journées de la semaine**. |
| 2026-08-16 | 6.3 | **Trois pannes empilées empêchaient la console d'enregistrer et de publier**, toutes muettes, aucune liée à la deploy key. (1) Le conteneur tournait en root alors que `/repo` appartient à `deploy` : git refusait le dépôt (`dubious ownership`) et toutes les écritures échouaient. (2) Une fois l'UID emprunté, `ssh` s'arrêtait sur `No user exists for uid 1002` — un UID sans ligne dans `/etc/passwd` n'a ni nom ni répertoire personnel. (3) Le build ne peut pas tourner dans le conteneur : dépendances installées sur l'hôte en **glibc**, image en **musl**, et les binaires natifs de rollup et sharp ne se partagent pas. | (1) `user:` dans Compose. (2) Compte créé dans l'image, UID en argument de construction. (3) Le build et le déploiement reviennent à l'hôte, via `scripts/publier.sh` appelé en ssh (`extra_hosts: hote:host-gateway`). **Chaîne vérifiée de bout en bout** : push réel vers GitHub, puis publication complète en **7 secondes** — 10 pages, 19 images retraitées. |
| 2026-08-16 | 5 | Le §5 (Caddyfile) ne s'applique pas. | Remplacé par `infra/nginx/` : `bxl-commun.conf` (fragment `(commun)`), `api.conf.modele`, `admin.conf.modele`, `site.conf.modele` (équivalent de `pnpm caddy`). Modèles en HTTP seul — c'est certbot qui ajoute le TLS, comme pour les 4 sites déjà en place. |
| 2026-08-17 | 7 bis | **Ajout d'un client ramené à un formulaire.** Il fallait six commandes dont deux en root, sur une session serveur : autant dire, au retour, le lendemain. La console fait maintenant tout : fichiers, enregistrement en base, commit poussé, puis — sur l'hôte — visuels, construction, déploiement, bloc nginx et certificat. Une minute. | Le bloc nginx demande root : utilitaire `bxl-vhost` **copié hors du dépôt** dans `/usr/local/sbin` par `infra/installer-vhost.sh`, seul programme autorisé par sudo. Une règle pointant vers `/srv/repo` aurait donné root à quiconque obtient la console, qui écrit dans ce dépôt à chaque enregistrement. 23 contrôles automatisés (`infra/bxl-vhost.test.sh`) : refus d'injection, relevé avant/après des sites de production, retour arrière. |
| 2026-08-17 | 7 bis | Un site créé en clientèle n'avait que deux issues : rester invisible — donc rien à montrer — ou passer « live », et livrer à Google un brouillon signé du nom du commerçant. | Statut **`preview`** ajouté au schéma : déployé et visible à son adresse, `noindex` et absent du sitemap. La fiche du client liste en permanence ce qu'il reste à remplir avant le passage en « live ». Le test d'indexation est écrit en négatif (« tout sauf live ») : un état ajouté plus tard sera couvert d'office. |
| 2026-08-17 | — | **Défaut trouvé en chemin, sans rapport avec la demande.** Les horaires, prestations, fermetures et équipe modifiés dans l'éditeur partaient dans git et s'affichaient sur le site, mais **la base n'était jamais mise à jour** : seul `pnpm tenant`, lancé à la main, la remplissait. L'agenda ne lit que la base. Fermer le lundi dans la console changeait donc le site sans changer la réservation, qui continuait d'accepter le lundi — sans le moindre signal, jusqu'au client devant une porte close. | Projection extraite dans `@bxl/api/tenant-sync`, appelée par le CLI **et** par la console après chaque enregistrement de contenu, chaque édition JSON et chaque création. Un échec de report est désormais dit à l'écran au lieu de passer inaperçu. |
| 2026-08-17 | 8 | **La base n'était sauvegardée nulle part.** Le §8 décrivait la procédure ; elle n'avait jamais été exécutée, aucune tâche planifiée n'existait et `/srv/sauvegardes` non plus. Un serveur sans sauvegarde fonctionne parfaitement jusqu'au jour où il ne fonctionne plus. | `infra/sauvegarde.sh` en minuterie systemd, chaque nuit à 3 h 17. Il **restaure** chaque archive dans une base jetable et y compte les lignes avant de la déclarer bonne : une sauvegarde jamais restaurée n'est qu'un fichier dont on suppose le contenu. Cycle vidage → gzip → restauration → comptage vérifié à la main sur la vraie base avant livraison. ⛔ **La copie hors du serveur reste à décider** : les archives vivent sur le disque de la base, et une destination inventée donnerait l'illusion d'une copie. `SAUVEGARDE_DISTANTE` attend la commande. |
| 2026-08-17 | — | **Rien ne surveillait rien.** API tombée, certificat non renouvelé, disque plein, site client muet : on l'apprenait par un appel du client. | `infra/surveillance.sh` toutes les dix minutes, en root — il lit `nginx -T` pour connaître **tous** les hôtes servis, y compris les quatre sites de production des autres projets, et les dates d'expiration des certificats. N'écrit qu'au changement d'état, jamais en continu : une surveillance qui parle tous les jours n'est plus lue au bout d'une semaine. |
| 2026-08-17 | — | Disque à 57 % avec **20 Go de cache de construction et 7,8 Go d'images inutilisées**, qui grossissent à chaque reconstruction de la console. Un disque plein n'arrête pas que ce projet : Postgres cesse d'écrire, nginx aussi, et les sites des autres projets tombent avec. C'est le seul point de rupture réellement partagé de la machine. | `infra/menage-docker.sh` chaque lundi. Ne touche jamais aux volumes — `docker volume prune` emporterait la base — et vérifie que les trois conteneurs tournent toujours après son passage. |
| 2026-08-17 | 7 ter | **Espace commerçant.** Tout changement de contenu passait par l'exploitant. Tenable pour une refonte de textes ; intenable pour « je suis malade, je ferme jeudi », qui est urgent par nature et se paie par un client devant une porte close. | Interface distincte sur son propre domaine, servie par la même application : `PORTAL_HOST` décide laquelle. Migration 007 : une colonne `tenant_slug` porte toute la distinction. **Enregistrer publie** — pas de second bouton à comprendre — et dans cet ordre : la base d'abord, qui commande la réservation, le site ensuite. Une reconstruction ratée laisse un site en retard mais un agenda déjà fermé ; l'ordre inverse aurait produit la panne qu'on veut éviter. Parcours complet vérifié en vrai : connexion, mot de passe imposé au premier accès, fermeture écrite dans `site.json` **et** dans `tenant_closures`, réouverture, ajout et retrait de prestation, retrait d'accès qui coupe la session à la requête suivante. |
| 2026-08-17 | 7 ter | Cloisonnement entre salons : trois barrières indépendantes — le rôle, le nom d'hôte, et l'absence totale d'identifiant de commerce dans les URL de l'espace (il vient de la session). Les lectures et l'annulation portent le `slug` **dans la clause `where`**, pas dans une vérification préalable. | Vérifié par requêtes réelles : un commerçant connecté est renvoyé au portail sur **toutes** les pages de la console ; un compte d'exploitation reçoit 404 sur le portail, sans boucle de redirection. |
| 2026-08-17 | — | **Les prestations ne pouvaient ni s'ajouter ni se supprimer** depuis la console : la page renvoyait à « l'édition avancée », c'est-à-dire au JSON brut. On ne dit pas ça à un coiffeur. | Gérées comme les horaires et la galerie — la liste complète est renvoyée, l'absence vaut retrait. L'identifiant est stable et n'est **jamais** repris du formulaire quand il est inconnu : des rendez-vous s'y réfèrent, et le laisser choisir de l'extérieur reviendrait à laisser quelqu'un d'autre décider à quoi ils se rattachent. La virgule décimale belge est acceptée — « 28,50 » lu par `Number()` donne NaN, donc « sur devis », donc un tarif disparu sans un mot. |
| 2026-08-17 | 6.4 | **`admin.hairbxl.be` n'avait pas de `client_max_body_size`** : nginx coupait à son mégaoctet par défaut alors que le code en accepte quarante. L'envoi de photos échouait donc pour **toutes** les vraies photos — une photo de téléphone en pèse trois à cinq — et le refus venait de nginx, que l'application ne voit jamais. | Porté à 40 Mo dans `admin.conf.modele` et dans le bloc en place, sauvegarde du fichier avant modification. |
| 2026-08-17 | — | Liens « ← Tous les clients » et redirection de l'exploitant pointant vers `/clients`, qui **n'existe pas** : la liste est servie à la racine. 404 silencieux. | Corrigé, et trouvé en pilotant l'application pour de vrai plutôt qu'en la lisant. |
| 2026-08-18 | 7 quater | **Le projet ne fait plus que des sites de coiffeur.** Notion de métier introduite, déduite de `business.type` — pas de champ supplémentaire, donc pas de contradiction possible entre ce que dit le fichier et ce que lit Google. Le métier commande le vocabulaire, les sections, les styles proposés, les visuels de remplacement et les pages de l'espace commerçant. | Un seul template, pas deux : deux templates divergeraient au premier correctif, et ce dépôt a déjà montré ce que deux copies de la même idée deviennent. Vérifié en construisant les deux démonstrations et en pilotant la console dans un vrai navigateur : le site du barbier est inchangé, section pour section et mot pour mot. |
| 2026-08-18 | 7 quater | Un site de fleuriste n'est pas un site de coiffeur recoloré : son client entre par l'occasion, sa carte change chaque semaine, et sa première question est « livrez-vous chez moi, et jusqu'à quelle heure ? ». | Quatre sections propres : occasions, fleurs de deuil, abonnement floral, livraison. Quatre styles réels — Serre, Nature morte, Marché, Herbier — et trois palettes florales, toutes passées aux contrôles de contraste existants. Le deuil est une section à part, sans prix ni formulaire : on ne fait pas comparer trois formules à quelqu'un qui enterre son père. |
| 2026-08-18 | 7 quater | La réservation ne se transpose pas : un fleuriste ne vend pas un créneau. | Table `orders` et route `/v1/orders` — occasion, budget, date, livraison ou retrait, mot pour la carte. **Aucun paiement**, et c'est un choix : ce qu'il pourra composer dépend de l'arrivage du matin. Mêmes protections que le formulaire de contact (piège à robots, origine, limite de débit), plus une contrainte en base qui refuse une livraison sans adresse. Route éprouvée en vrai contre la base : commande enregistrée, et refus vérifiés pour l'adresse manquante, la date passée, le commerce inconnu et le consentement absent. |
| 2026-08-18 | — | `durationMin` devient facultatif — un bouquet n'a pas de durée — mais reste **obligatoire dès que le site prend des rendez-vous** : c'est elle qui découpe les créneaux, et une durée absente donnerait un agenda dont tous les rendez-vous se chevauchent. | Contrôle dans le schéma, et `tenant_services` ne reçoit plus que les prestations réservables. La table sert l'agenda : une composition florale n'a rien à y faire. |
| 2026-08-18 | — | Défaut trouvé en pilotant l'espace commerçant : la date d'une commande s'affichait « Fri Aug 21 ». Le pilote Postgres rend les colonnes `date` sous forme d'objets, et `String(date).slice(0, 10)` produisait une chaîne que `new Date()` refuse — la fonction rendait donc cette bouillie telle quelle au commerçant. | `dateLisible()` accepte les deux formes. Trouvé parce que la page a été ouverte pour de vrai, pas relue. |
| 2026-08-18 | 7 ter | Le commerçant n'avait qu'un bouton grisé pour toute confirmation pendant la minute que dure une mise en ligne. On croit que ça a planté, on revient en arrière, et l'enregistrement se perd à mi-chemin. | Voile plein écran : grand rond qui tourne, ce que fait l'action, « ne fermez pas cette page ». Il n'apparaît qu'après 400 ms — les actions instantanées reviennent avant, et un voile qui clignote inquiète au lieu de rassurer. À quinze secondes il dit que c'est normal ; à trois minutes il admet que quelque chose ne va pas et rend la main avec un lien de rechargement, plutôt que d'enfermer. Il respire au lieu de tourner en « mouvement réduit ». |
| 2026-08-18 | 7 ter | ⚠️ **L'avertissement « Quitter le site ? » a été essayé puis retiré.** `beforeunload` se déclenche sur **toute** navigation sortante — y compris celle du formulaire lui-même quand la réponse arrive. Le commerçant aurait donc vu la boîte de dialogue à **chaque enregistrement réussi**. | Constaté dans un vrai navigateur : le test automatisé s'est bloqué sur la boîte, ce qui a révélé le défaut avant la livraison. Un avertissement qui se trompe une fois sur deux apprend à cliquer « Quitter » sans lire, et ne protège alors plus de rien. Le voile suffit : il occupe l'écran et verrouille le bouton. |
| 2026-08-18 | 7 quinquies | **Duplication d'un site.** Préparer un client obligeait à repartir d'un squelette vide alors qu'on a souvent sous la main un site abouti du même métier. La copie naît en brouillon — aucune adresse, aucun certificat, rien de déployé — et ne devient publique qu'à la mise en ligne, ce qui laisse le temps de corriger tout ce qui désigne encore l'autre commerce. | Le `tenantId` est régénéré : c'est la clé sous laquelle l'API range rendez-vous, messages et commandes, et deux sites qui la partagent reçoivent le courrier l'un de l'autre sans qu'aucune erreur ne le signale. Avis, mentions légales, liens Google et réseaux sociaux sont écartés — recopier des avis publierait des témoignages que personne n'a écrits pour ce commerce. Ce qui est retiré est annoncé à l'arrivée, jamais en silence. |
| 2026-08-18 | 7 quinquies | Le téléphone et l'e-mail **sont** recopiés, pour servir de repère à la saisie — mais ils désignent encore l'autre commerce, et les deux valeurs sont parfaitement valides : rien ne le signalerait. | La fiche compare les coordonnées avec celles des autres clients tant que le site n'est pas en ligne, et le dit en rouge. Comparaison sur la valeur du numéro et non sur son écriture : `+32 2 111 11 11` et `02/111.11.11` sont le même poste, et le cas arrive en recopiant depuis une fiche Google. |
| 2026-08-18 | 7 quinquies | « Mettre en ligne » ne faisait que construire et déployer. Sur un site jamais publié — donc sur tout doublon — il aurait déposé des fichiers que rien ne sert : pas de bloc nginx, pas de certificat, un site introuvable. | Le bouton installe complètement quand le site n'a jamais été mis en ligne, et se contente de publier ensuite. Il promeut aussi le brouillon en « En préparation » : c'est ce qu'il annonce, et refuser aurait obligé à changer un menu déroulant avant d'appuyer sur le bouton qui dit déjà ce qu'il fait. |
| 2026-08-18 | — | ⚠️ Défaut évité : `scripts/nouveau-site.sh` régénérait toujours les visuels de remplacement, aux noms fixes `hero.jpg` et `galerie-*.jpg`. La première mise en ligne d'un site dupliqué aurait donc remplacé ses photos par des dégradés abstraits, sans un mot. | Les visuels ne sont générés que si le dossier `media` est vide. Un client créé de zéro les reçoit ; un doublon garde les siens. |
