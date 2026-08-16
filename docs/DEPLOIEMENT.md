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

Une fois la connexion `deploy` confirmée :

```bash
# Sur le serveur, en root :
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sshd -t && systemctl restart ssh
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
| A | `*` | `<IP>` | *(facultatif)* les sous-domaines clients — voir §7 |

Un enregistrement générique `*` évite d'en créer un par client. Il n'est pas
obligatoire : un enregistrement nominatif par sous-domaine fonctionne aussi, et
laisse une trace plus lisible de ce qui existe.

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

```bash
# Depuis le poste :
scp infra/Caddyfile root@<IP>:/etc/caddy/Caddyfile

# Sur le serveur :
systemctl daemon-reload
caddy validate --config /etc/caddy/Caddyfile   # doit répondre « Valid configuration »
systemctl reload caddy
```

**Vérifier :** `systemctl status caddy` est `active (running)`, et
`journalctl -u caddy -n 30` ne montre aucune erreur.

À ce stade aucun site n'est encore servi : le `Caddyfile` importe
`/etc/caddy/sites/*.caddy`, qui est vide. C'est normal.

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
git clone git@github.com:NoppeHugo/WebsiteBXL.git /srv/repo
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
| `RESEND_API_KEY` | fournie par l'exploitant |
| `MAIL_FROM` | ex. `Réservations <no-reply@<domaine>>` — le domaine doit être vérifié chez Resend |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | fournies par l'exploitant |
| `PUBLIC_API_URL` | `https://api.<domaine>` |
| `PUBLIC_ADMIN_URL` | `https://admin.<domaine>` |
| `REPO_PATH` | `/srv/repo` |
| `SSH_KEY_PATH` | `/home/deploy/.ssh/id_ed25519` |
| `DEPLOY_HOST` | `deploy@<IP>` |

```bash
chmod 600 .env
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

### 7.1 Choisir son adresse

Deux possibilités, détaillées en §3.10 du README :

- **Sous-domaine du domaine de service** — `kevin.hair.be`. Immédiat, gratuit,
  parfait pour montrer le site pendant la vente.
- **Domaine propre au client** — `kevincoiffure.be`. C'est ce qui se met sur
  une carte de visite et sur la vitrine.

Les deux s'écrivent de la même façon dans `clients/<slug>/site.json` :

```json
{
  "domain": "kevincoiffure.be",
  "aliases": ["kevin.hair.be", "www.kevincoiffure.be"]
}
```

`domain` est l'adresse canonique — celle qui figure dans les balises de la page
et dans les données structurées. Les `aliases` redirigent vers elle.

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
langues activées.

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
| | | | |
