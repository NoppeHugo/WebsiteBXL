# WebsiteBXL

Plateforme de production, d'hébergement et de maintenance de sites vitrines pour
les commerces bruxellois — construite et opérée par une seule personne,
photographe et développeur.

Ce fichier est le document de référence du projet : il contient l'objectif,
le modèle économique, toutes les décisions techniques et leur justification,
et la feuille de route. Toute décision d'architecture doit être cohérente avec
ce qui est écrit ici, ou bien ce fichier doit être mis à jour.

---

## 1. Le projet en une phrase

Vendre en porte-à-porte des sites vitrines à des commerçants bruxellois, en
entrant par une séance photo offerte, puis facturer un abonnement mensuel
d'hébergement et de maintenance qui constitue le revenu récurrent.

### L'avantage concurrentiel

Deux compétences rarement réunies chez la même personne : **la photo et le
développement**. Une agence sous-traite les photos ; un photographe ne sait pas
livrer un site. Ici, les deux sont faits par la même personne, sur place, le
même jour. C'est ce qui permet à la fois la qualité visuelle et un coût de
production assez bas pour rendre l'abonnement rentable.

### Le modèle économique

| Palier | Setup | Mensuel | Contenu |
|---|---|---|---|
| **Essentiel** | 490 € | 25 €/mois | One-page, mobile, photos, horaires, contact, plan, fiche Google. 1 langue. |
| **Pro** *(à pousser)* | 790 € | 39 €/mois | Multi-pages, bilingue FR/NL, réservation en ligne, séance photo complète, Google optimisé + suivi. |
| **Signature** | 1 290 € | 59 €/mois | Trilingue (+EN), réservation avancée, mini-boutique, shooting saisonnier, modifs illimitées. |

Ce que couvre le mensuel, à énoncer explicitement au client sous peine de
résiliation : hébergement, nom de domaine, sécurité et sauvegardes, mise à jour
de la fiche Google, quota de petites modifications, et rapport d'audience
mensuel.

**Règles de tarification :**

- Le setup peut être payé en 2-3 fois pour lever l'objection prix.
- Le mensuel ne descend **jamais** sous 25 €, même en promo de lancement. Un
  client à 15 €/mois ne vaut pas le coût de sa gestion. Si une remise est
  nécessaire pour signer, offrir le premier mois ou une séance photo bonus —
  jamais le tarif récurrent.
- Mandat SEPA signé le jour de la signature. Non négociable dans le process.
- Les 2-3 premiers clients : setup à 0 €, mensuel seul, en échange d'un
  témoignage écrit et du droit d'amener des prospects voir le résultat sur
  place. Ils ne rapportent pas d'argent, ils rapportent la preuve qui vend les
  cinquante suivants.

### Cible

**Niche de départ : coiffeurs, barbershops, instituts de beauté.** Critères qui
les rendent idéaux : lieux très visuels (avant/après, ambiance, déco), patrons
jeunes et attentifs à leur image, décideur présent sur place donc décision
rapide, besoin réel de réservation en ligne, et forte densité dans les quartiers
branchés — ce qui permet de démarcher une rue entière d'affilée.

**Niche secondaire :** métiers de bouche artisanaux (boulangeries, pâtisseries,
chocolatiers, traiteurs, cavistes).

**À éviter au démarrage :** restaurants (marges fines, patrons débordés, déjà
saturés par TheFork/Deliveroo, fort taux d'échec) et fleuristes (petites marges,
saisonniers). On y reviendra avec des références en poche.

**Zones de prospection, une rue à la fois :** Châtelain, Parvis de Saint-Gilles,
Flagey / Chaussée d'Ixelles, Dansaert, Bascule (Uccle). La densité est
stratégique : « je viens de faire le site du salon d'à côté » est l'argument le
plus efficace du projet.

### Deux leviers spécifiquement bruxellois

1. **Le bilingue FR/NL** (voire +EN vers le quartier européen). Beaucoup de
   commerces en ont besoin, presque personne ne le leur fait proprement.
   Argument de vente et upsell naturel.
2. **Google Business Profile.** Le vrai problème du petit commerce n'est pas
   « je n'ai pas de site », c'est « on ne me trouve pas sur Google Maps ». Le
   pack site + fiche Google optimisée répond à la douleur réelle et peut servir
   d'accroche d'entrée.

---

## 2. Le principe directeur de l'architecture

> Dans deux ans, il y aura 30 sites vivants à maintenir **seul**.

Toute décision technique se juge sur une seule question : *quand un bug doit
être corrigé ou une dépendance mise à jour, combien de fois faut-il le faire ?*

La réponse doit toujours être : **une seule fois.**

C'est ce qui rend un abonnement à 25-39 €/mois réellement rentable. Un modèle où
chaque site est un projet séparé s'effondre vers 15 clients, quand la
maintenance non facturée mange les week-ends.

---

## 3. Décisions techniques

### 3.1 Monorepo — un seul repo, pas un repo par site

**Décision :** un unique repo privé. Un template partagé, et chaque client n'est
que de la **donnée** (un dossier de configuration + des photos).

**Pourquoi :** un repo par site signifie N fois le même correctif à copier-coller,
N audits de dépendances, N pipelines. C'est le piège classique de l'agence solo.

**Contrepartie assumée :** un template cassé casse potentiellement tous les
sites. Garde-fous obligatoires, décrits en §6.

**Porte de sortie :** si un site doit un jour être cédé à un client,
`git subtree split` extrait proprement son dossier. On ne s'enferme pas.

### 3.2 Sites en statique — Astro

**Décision :** les sites vitrines sont générés en HTML statique avec Astro.

**Pourquoi :**
- Aucun serveur applicatif par site → zéro maintenance, zéro surface d'attaque,
  zéro base de données à sauvegarder pour la partie vitrine.
- i18n natif, indispensable pour l'argument FR/NL.
- Optimisation d'images automatique — critique quand on livre ses propres
  photos : c'est le métier, elles doivent être belles **et** rapides.
- Score Lighthouse quasi parfait par défaut, qu'on peut montrer au prospect.

**Écarté :** WordPress (maintenance et sécurité ingérables ×30), Next.js
(aucun besoin de rendu serveur pour une vitrine).

### 3.3 Le thème comme donnée

Chaque client possède un `theme.json` (couleurs, typographie, variante de mise
en page, effets) en plus de son `site.json` (contenu).

**Pourquoi :** 30 sites qui ne se ressemblent pas, sans écrire 30 bases de code.
Un coiffeur ne doit jamais pouvoir dire « c'est le même site que le salon d'en
face ».

**Champs disponibles :**

| Champ | Valeurs | Effet |
|---|---|---|
| `palette` | 7 couleurs hexadécimales | Fond, surface, texte, texte atténué, accent, texte sur accent, bordure. |
| `fonts.display` / `.body` | pile CSS | Titres et texte courant. |
| `fonts.displayWeight` / `.displayTracking` / `.displayTransform` | — | Graisse, interlettrage et casse des titres. |
| `fonts.uiTransform` / `.uiTracking` | — | Casse et interlettrage des boutons et de la navigation. |
| `layout.hero` | `fullbleed` \| `split` \| `minimal` | Structure du hero. |
| `layout.heroAlign` | `start` \| `center` | Texte du hero ancré à gauche, ou centré. |
| `layout.gallery` | `grid` \| `mosaic` \| `strip` | Disposition des photos. |
| `layout.nav` | `overlay` \| `solid` | Navigation par-dessus la photo, ou opaque. |
| `radius` | `none` \| `soft` \| `round` | `round` donne cartes arrondies et boutons en pilule. |
| `grain` | booléen | Grain photographique léger. |
| `effects.glass` | booléen | Surfaces translucides floutées. |
| `effects.blur` | 0–60 | Intensité du flou, en pixels. |
| `effects.reveal` | booléen | Apparition en fondu au défilement. |

**Style maison** (défaut de `pnpm new`) : typographie système Apple, fond noir,
accent bleu, boutons en pilule, verre et apparition au défilement. C'est la
**palette**, et surtout la couleur d'accent, qu'on change d'un client à l'autre
pour les différencier — pas la structure.

### 3.3 bis Polices : pourquoi la pile système

**Décision :** aucune police n'est hébergée pour l'instant ; on utilise la pile
système `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, …`.

**Pourquoi :** SF Pro, la police d'Apple, **ne peut pas être hébergée sur le
site d'un client** — sa licence la réserve aux plateformes Apple. La pile
système la fournit nativement sur iPhone et Mac, donc la démo montrée sur
téléphone affiche la vraie SF Pro, légalement et sans un octet à télécharger.
Sur Windows et Android, le repli sur Segoe UI et Roboto reste très proche.

**Montée en gamme quand un rendu identique partout sera nécessaire :**
auto-héberger **Inter** (licence libre, dessinée dans le même esprit que SF)
dans `apps/template/public/fonts`. Jamais via le CDN Google Fonts : le
transfert d'adresses IP vers un tiers hors UE a déjà valu des condamnations en
Europe.

### 3.3 ter Le verre : un effet, deux contraintes

**Décision :** les surfaces translucides (`effects.glass`) sont limitées à la
navigation, aux cartes d'avis, au bandeau de réservation et à la barre mobile.

**Pourquoi cette limite :** chaque zone floutée est recomposée par le processeur
graphique à chaque défilement. En multiplier les occurrences fait saccader les
téléphones d'entrée de gamme — or c'est précisément sur téléphone que se joue
l'essentiel du trafic d'un commerce de proximité.

**Et la couleur d'accent** reste réservée aux boutons et aux anneaux de focus.
Un bleu d'action en petit corps sur fond sombre ne tient pas les seuils de
contraste, et disperser la couleur affaiblit le seul endroit où elle doit
attirer l'œil : le bouton de réservation.

L'apparition au défilement (`effects.reveal`) masque du contenu par JavaScript.
Trois garde-fous en découlent, tous en place : la classe qui masque est posée
par le script (sans JavaScript, rien n'est caché), l'effet est désactivé à
l'arrivée sur une ancre, et l'impression force l'affichage complet.

### 3.4 Caddy comme serveur web

**Décision :** Caddy, pas nginx.

**Pourquoi :** HTTPS Let's Encrypt automatique par domaine, renouvellement
inclus, aucun certbot à surveiller. Avec 30 domaines clients, c'est
l'automatisation qui compte le plus.

### 3.5 Déploiement par releases + symlink

Chaque déploiement écrit un nouveau dossier `releases/<horodatage>/` puis bascule
le symlink `current`. Bascule atomique, aucune coupure, rollback instantané.

### 3.6 Git comme source de vérité du contenu

**Décision :** le contenu des sites (`site.json`, `theme.json`, médias) vit dans
git. Postgres ne stocke **que** les données transactionnelles : réservations,
clients finaux, facturation, audience.

**Pourquoi :** historique complet, rollback trivial, édition possible à la main
quand c'est plus rapide, et la console admin (§3.7) n'est qu'un éditeur qui
commit. Chaque outil à sa place.

### 3.7 Console d'administration — mono-utilisateur, pilotage de tous les sites

**Décision :** une application web privée, sur `admin.<domaine>`, qui permet de
piloter l'ensemble des sites hébergés sur le VPS depuis une seule interface.

**Fonctions prévues :**
- Liste des clients, statut (en ligne / suspendu / en préparation).
- Édition du contenu par formulaires (horaires, services, tarifs, textes) au
  lieu d'un JSON à la main.
- Upload et recadrage des photos.
- Prévisualisation avant publication.
- Bouton **Publier** : commit + push + build + déploiement.
- Agenda des réservations par client.
- Audience du mois et génération du rapport client.
- Statut d'abonnement et de paiement, bouton de suspension.

**Fonctionnement :** la console écrit dans un clone du repo présent sur le VPS,
commit, push, puis déclenche le build et le déploiement du seul client modifié.
Git reste la source de vérité ; la console n'est qu'une interface d'écriture
confortable.

**Sécurité :** même avec un seul utilisateur, l'authentification est sérieuse —
mot de passe haché (argon2), 2FA TOTP, sessions à expiration, limitation du
nombre de tentatives. Cette console peut modifier et mettre hors ligne
l'intégralité des sites clients : c'est l'actif le plus sensible du projet.

**Séquencement :** conçue dès maintenant au niveau du format des données, mais
**construite en phase 2**, après les premiers clients payants. À 3 sites,
éditer un JSON reste plus rapide que n'importe quelle interface. La console se
justifie quand le temps perdu en édition manuelle devient réel, vers 5-8 clients.

### 3.8 Réservation en ligne — produit maison, différenciateur du Premium

**Décision :** développer un service de réservation multi-tenant maison plutôt
que d'intégrer un prestataire externe.

**Pourquoi :** c'est ce qui justifie le palier Premium, ce qui rend le service
difficile à remplacer, et ce qu'un concurrent non-développeur ne peut pas
proposer. Un salon qui a son agenda en ligne chez toi ne part pas.

**Architecture :** un service unique multi-tenant (Node/TypeScript + Postgres)
servi sur `api.<domaine>`. Le site statique du client embarque un widget léger
qui dialogue avec l'API via son `tenantId`. Un seul service pour tous les
clients — cohérent avec le principe directeur : on ne corrige qu'une fois.

**Modèle de données :** `tenants`, `resources` (les coiffeurs), `services`
(durée, prix), `opening_hours`, `closures` (congés, jours fériés),
`appointments`, `customers`.

**Le vrai point dur** n'est pas la génération des créneaux, c'est la
**concurrence** : deux clients qui réservent le même créneau à la même seconde.
Cela se règle par une contrainte d'unicité en base et une transaction avec
verrou, pas par une vérification applicative. À traiter dès la v2, pas après.

**Phasage :**

- **v1 — demande de rendez-vous.** Le client final choisit un service et un
  créneau souhaité, le salon confirme manuellement par email. Quelques jours de
  développement, aucun risque de double-réservation, et permet de **vendre le
  Premium immédiatement**.
- **v2 — agenda temps réel.** Disponibilités calculées en direct (durée du
  service, ressource, horaires, congés, temps tampon), confirmation
  automatique, gestion de la concurrence.
- **v3 — rappels et anti no-show.** Rappel SMS 24 h avant, annulation en ligne,
  historique client. Le SMS a un coût réel (~0,05 €/envoi) : à répercuter ou à
  plafonner dans le mensuel.

**Exigence de fiabilité :** un agenda qui double-book un samedi fait perdre du
chiffre d'affaires au salon. La barre de qualité est bien plus haute que sur une
vitrine — sauvegardes quotidiennes de la base, supervision, alerte en cas
d'indisponibilité de l'API.

**Obligation RGPD :** les rendez-vous contiennent des données personnelles de
clients finaux. Position juridique : **sous-traitant** du commerçant, qui est
responsable de traitement. Nécessite un contrat de sous-traitance (DPA) signé
avec chaque commerçant, un registre des traitements, une durée de conservation
définie et une procédure d'effacement. Ce n'est pas un détail administratif :
c'est une obligation légale dès le premier rendez-vous enregistré.

### 3.8 bis Mentions légales — obligatoires, et vérifiées automatiquement

**Décision :** chaque site possède une page de mentions légales, générée dans
toutes ses langues à partir du bloc `legal` de `site.json`.

**Pourquoi :** le livre XII du Code de droit économique impose à tout site
commercial belge de rendre accessibles en permanence l'identité de
l'entreprise, son numéro d'entreprise, sa TVA, ses coordonnées et l'identité de
son hébergeur. Ce n'est pas une formalité qu'on ajoute après : c'est une
condition pour facturer un site à un commerçant.

`pnpm check` refuse tout site en statut `live` sans bloc `legal` — la
vérification est bloquante, pas indicative. Un brouillon, lui, peut rester
incomplet.

La même page porte la section « données personnelles », rendue nécessaire par
le formulaire de contact et, plus tard, par la réservation.

### 3.9 Édition de contenu par le client — non

Le client ne modifie rien lui-même. Les modifications passent par la console
(§3.7). **C'est un choix commercial, pas une limitation :** « vous ne touchez à
rien, je m'occupe de tout » est précisément ce qui est facturé dans le mensuel,
et cela évite qu'un commerçant casse la mise en page un vendredi soir.

Réévaluation possible vers 25-30 clients avec un CMS git-based (Decap), qui se
branche sur du statique sans backend. Le format de données est conçu pour rendre
ce branchement trivial le jour venu.

### 3.10 Noms de domaine au nom du client

**Décision :** chaque domaine est enregistré au nom du commerçant ; la gestion
technique du DNS reste de notre côté.

**Pourquoi :** enregistrer les domaines à son propre nom pour verrouiller le
client crée un conflit juridique le jour où la relation se termine mal — pour
12 € par an. Et c'est un **argument de vente** : « le domaine vous appartient,
vous n'êtes pas prisonnier » rassure beaucoup et différencie des prestataires
qui font l'inverse. Le verrouillage doit venir de la qualité du service, pas de
la prise d'otage.

### 3.11 Suspension pour impayé, prévue dès le départ

Un drapeau `suspended: true` dans `site.json` déploie une page « site
temporairement indisponible ». Deux lignes de code maintenant ; une improvisation
dans l'urgence si on l'oublie.

### 3.12 Paiement — Mollie

**Décision :** Mollie plutôt que Stripe.

**Pourquoi :** acteur du Benelux, gestion des mandats de domiciliation SEPA
nettement meilleure et moins chère pour un usage belge. Le prélèvement doit
tourner seul, sinon on court après les paiements.

### 3.13 Analytics — Umami auto-hébergé (arme anti-churn)

**Décision :** Umami (ou Plausible) auto-hébergé sur le même VPS, sans cookies
— donc sans bandeau de consentement, ce qui préserve le design des sites.

**Pourquoi c'est stratégique et pas cosmétique :** chaque mois, le commerçant
reçoit « 340 visites, 28 clics sur l'itinéraire, 12 appels depuis le site ».
C'est **ça** qui empêche la résiliation au bout de huit mois : il voit ce qu'il
achète. Le churn est le vrai risque du modèle, et ce rapport mensuel automatisé
en est la meilleure défense — pour un coût nul une fois branché.

### 3.14 Emails transactionnels — Resend

Formulaires de contact et confirmations de réservation passent par un
prestataire (Resend ou Postmark). **Ne jamais auto-héberger de SMTP :**
délivrabilité catastrophique et maintenance permanente.

---

## 4. Architecture

### 4.1 Structure du repo

```
WebsiteBXL/
├─ apps/
│  ├─ template/            # LE site vitrine. Un seul. Astro.
│  │  ├─ src/components/   # Hero, Services, Galerie, Horaires, Avis, Contact, Map, CTA résa
│  │  ├─ src/layouts/
│  │  └─ src/pages/[lang]/ # i18n FR / NL / EN
│  └─ console/             # Console admin + API réservation (Node/TS + Postgres)
├─ clients/
│  ├─ salon-marie/
│  │  ├─ site.json         # nom, adresse, tél, horaires, services, tarifs, domaine, langues, suspended
│  │  ├─ theme.json        # couleurs, typographie, variantes de mise en page
│  │  └─ media/            # photos sources
│  └─ barber-dansaert/
├─ packages/
│  └─ schema/              # types partagés + validation de site.json / theme.json
├─ scripts/
│  ├─ new-client.ts        # génère le squelette d'un client
│  ├─ build.ts             # build un client ou tous
│  └─ deploy.sh            # rsync + bascule de symlink
└─ infra/
   ├─ Caddyfile
   ├─ docker-compose.yml   # console, Postgres, Umami
   └─ setup-vps.sh
```

Ajouter un client = un dossier, un JSON, des photos.
`CLIENT=salon-marie pnpm build` → `dist/salon-marie/`.

### 4.2 Organisation du VPS

```
/srv/sites/salon-marie/releases/2026-08-14-1/
/srv/sites/salon-marie/current -> releases/2026-08-14-1
/srv/repo/                        # clone utilisé par la console
/etc/caddy/Caddyfile              # import /etc/caddy/sites/*.caddy
/etc/caddy/sites/salon-marie.caddy
```

Bloc Caddy par client :

```caddy
salonmarie.be, www.salonmarie.be {
    root * /srv/sites/salon-marie/current
    encode zstd gzip
    file_server
}
```

Les services dynamiques (console, Postgres, Umami) tournent en Docker Compose
derrière Caddy. Les sites vitrines, eux, sont servis directement depuis le
disque : aucun processus par site.

### 4.3 Économie de l'infrastructure

Un VPS à 6-10 €/mois absorbe sans difficulté 50 sites statiques plus les
services partagés. À 30 clients à 30 €/mois, le coût d'infrastructure représente
environ 1 % du récurrent. **C'est cette asymétrie qui rend tout le modèle
viable** — et c'est une raison de plus de ne jamais introduire de composant
serveur par client.

### 4.4 Intégration continue

Sur push vers `main` : détection des clients modifiés, build de ceux-là
uniquement (ou de tous si `apps/template` a changé), puis `rsync` vers le VPS
par clé SSH stockée en secret GitHub.

---

## 5. Le processus commercial

### Le pitch — entrer par la photo, jamais par le site

**1. L'entrée (à froid, on pousse la porte)**

> « Bonjour, je suis photographe dans le quartier — je fais des photos des
> salons du coin. Je peux vous prendre une belle photo de votre salon, c'est
> cadeau, ça vous prend deux minutes. »

On shoote immédiatement (ou on fixe un rendez-vous si c'est plein), puis on
montre le résultat retouché sur l'écran. C'est leur salon, et il est beau :
l'accroche est émotionnelle.

**2. La transition**

> « Franchement ça rend super bien. Je fais aussi les sites web des salons — je
> suis développeur à la base. Quand on tape votre nom sur Google, on tombe sur
> quoi aujourd'hui ? »

Cette question est l'arme principale. Dans la grande majorité des cas la réponse
est « rien », « ma page Facebook » ou une vieille fiche à l'abandon. Le prospect
constate le problème lui-même — on ne le lui assène pas.

**3. Le closing léger**

> « Je vous montre vite fait ce que je fais pour les autres salons ? Deux
> minutes, sans engagement. Si ça vous parle on en reparle, sinon vous gardez la
> photo, elle est à vous. »

Montrer trois choses concrètes : le rendu sur mobile, le bouton de réservation,
la fiche Google qui remonte.

**Les deux règles :** le cadeau photo désamorce le réflexe « encore un
commercial » ; et on repart toujours sans forcer. Le « sans engagement, la photo
est à vous » installe le souvenir du type sympa plutôt que du vendeur —
beaucoup rappellent après réflexion.

### Timing

Passer quand c'est calme : jamais le samedi chez un coiffeur, jamais pendant le
service dans un commerce de bouche. Milieu de matinée ou milieu d'après-midi, en
semaine.

### Objections préparées

| Objection | Réponse |
|---|---|
| « J'ai déjà Facebook / Insta » | Vous ne possédez rien, Google ne vous référence pas, et il n'y a ni tarifs ni réservation. |
| « Trop cher » | L'abonnement sert précisément à baisser le coût de départ ; le setup est payable en plusieurs fois. |
| « Pas le temps » | Je fais tout, vous ne touchez à rien. |
| « J'ai déjà un site » | Question test : il est comment sur téléphone ? On peut le regarder ensemble. |

### Preuve sociale plutôt que démo fictive

Un faux site de commerce imaginaire est un pis-aller. La vraie preuve, ce sont
les 2-3 premiers vrais sites, faits gratuitement en échange de témoignages et du
droit d'amener des prospects sur place. Une boutique voisine qui dit « il a fait
le mien, super » vaut cent démos.

---

## 6. Risques et garde-fous

### Le risque n°1 : le churn, pas la vente

Le porte-à-porte à froid essuie beaucoup de refus, mais c'est prévisible et ça
se compense par le volume. Le vrai danger à long terme est la résiliation des
abonnements. **Objectif : conserver les dix premiers clients avant d'en chasser
cinquante.** Les défenses concrètes : le rapport d'audience mensuel (§3.13), un
mensuel qui rend un service réel et visible, et la réservation en ligne qui rend
le départ coûteux.

### Le risque du monorepo

Un template cassé peut casser tous les sites au prochain build. Deux garde-fous,
à mettre en place dès la phase 0 et non « plus tard » :

1. **Build en CI qui échoue avant tout déploiement.** Rien ne part si le build
   ne passe pas.
2. **Déploiement par releases + symlink.** Le site en ligne ne bascule que si le
   nouveau build est valide, et le retour arrière est instantané.

Avec ces deux mécanismes, le risque est maîtrisé et l'avantage en maintenance
reste écrasant.

### Le risque de la console

C'est le point le plus sensible du système : une seule application capable de
modifier et de mettre hors ligne tous les sites clients. Authentification forte,
2FA, et journalisation de toutes les publications.

### Le risque de la réservation

Une indisponibilité de l'API ou une double-réservation touche directement le
chiffre d'affaires du client. Sauvegardes quotidiennes de Postgres testées
(une sauvegarde jamais restaurée n'est pas une sauvegarde), supervision de
l'API, et contrainte d'unicité en base dès la v2.

### Le risque juridique et administratif

- Statut d'indépendant et TVA réglés **avant** la première facture.
- DPA signé avec chaque commerçant utilisant la réservation.
- Conditions générales couvrant le mensuel, le préavis et la suspension pour
  impayé.

### Le risque de lenteur de production

La marge vient de la vitesse de livraison. Si un site prend deux semaines au
lieu de deux jours, le modèle ne tient plus. D'où le template réutilisable, le
`theme.json`, et le script `new-client`. **Objectif : un site livré en une
demi-journée de travail effectif**, photos comprises.

---

## 7. Feuille de route

### Phase 0 — Fondations ✅ *(objectif : avoir quelque chose à montrer)*

- [x] Monorepo, template Astro, composants orientés coiffeur.
- [x] `site.json` / `theme.json` avec schéma validé (`packages/schema`).
- [x] Scripts `new`, `dev`, `build`, `check`, `caddy`, `deploy`.
- [x] VPS : Caddy, arborescence, déploiement par releases + lien symbolique.
- [x] Intégration continue : contrôle et build de tous les clients.
- [x] Site de démonstration (`clients/demo-barbier`), trilingue, présentable
      sur téléphone.

Reste à faire avant la prospection : remplacer les visuels de remplacement du
site de démonstration par de vraies photos, et renseigner `STUDIO` dans
`apps/template/src/lib/studio.ts` pour la signature en pied de page.

### Phase 1 — Livrable et clients pilotes *(objectif : valider la vente)*

Finitions qui rendent un site réellement facturable :

- [x] `robots.txt` et `sitemap.xml` générés par client, avec les correspondances
      entre langues. Non indexables tant que le site n'est pas `live`.
- [x] Favicon et icône d'écran d'accueil iOS, générées depuis l'initiale du
      commerce et sa couleur d'accent.
- [x] Page de mentions légales dans toutes les langues, avec section données
      personnelles. Bloquante en contrôle pour un site `live`.
- [x] Formulaire de contact avec consentement, piège à robots et envoi sans
      JavaScript en repli. Affiché seulement si un point d'envoi est configuré.

Reste, sur le terrain :

- 2-3 salons pilotes, setup offert contre témoignage.
- Fiche Google Business optimisée pour chacun.
- Déploiement en ligne de commande, sans console.
- **Aucune fonctionnalité nouvelle** tant que la vente n'est pas validée sur le
  terrain.

### Phase 2 — Passage à l'échelle du contenu

- Console admin : liste des clients, édition par formulaires, upload photos,
  prévisualisation, publication.
- Umami + rapport d'audience mensuel automatisé.
- Mollie : mandats SEPA et prélèvements automatiques.
- Drapeau de suspension opérationnel.

### Phase 3 — Réservation v1 *(débloque la vente du Premium)*

- Demande de rendez-vous : choix du service, créneau souhaité, email au salon.
- Widget embarqué dans le template.
- DPA et registre RGPD en place.

### Phase 4 — Réservation v2

- Agenda temps réel, disponibilités calculées, confirmation automatique.
- Gestion de la concurrence en base.
- Interface agenda dans la console.

### Phase 5 — Consolidation

- Rappels SMS et annulation en ligne.
- Deuxième niche (métiers de bouche) avec ses propres variantes de template.
- Envisager un CMS git-based si le volume le justifie.

---

## 8. Prise en main

### Installation

```bash
pnpm install
cp .env.example .env      # renseigner DEPLOY_HOST une fois le VPS prêt
```

### Commandes

| Commande | Effet |
|---|---|
| `pnpm new <slug> --name "Nom" --plan pro` | Crée un client : `site.json`, `theme.json` et des visuels de remplacement. |
| `pnpm dev <slug>` | Serveur de développement sur un client. |
| `pnpm build <slug>` | Construit un site dans `dist/<slug>/`. |
| `pnpm build:all` | Construit tous les clients (ce que fait l'intégration continue). |
| `pnpm check` | Valide tous les clients sans construire : format, photos manquantes, traductions absentes. |
| `pnpm caddy <slug>` | Génère le bloc Caddy du client depuis son domaine et ses alias. |
| `pnpm placeholders <slug>` | Régénère les visuels de remplacement. |
| `./scripts/deploy.sh <slug>` | Déploie sur le VPS (nouvelle release + bascule du lien). |

### Livrer un nouveau client

```bash
pnpm new salon-marie --name "Salon Marie" --domain salon-marie.be
# remplir clients/salon-marie/site.json
# déposer les photos de la séance dans clients/salon-marie/media/
pnpm dev salon-marie                       # prévisualiser
# passer "status" à "live" dans site.json
pnpm check && pnpm build salon-marie
pnpm caddy salon-marie --out ./out         # bloc à déposer dans /etc/caddy/sites/
./scripts/deploy.sh salon-marie
```

Le déploiement refuse tout site qui n'est pas en statut `live` : impossible de
mettre en ligne un brouillon par inadvertance.

### Mise en place du VPS

```bash
scp infra/setup-vps.sh root@vps:/tmp/
ssh root@vps 'ACME_EMAIL=ton@adresse.be bash /tmp/setup-vps.sh'
scp infra/Caddyfile root@vps:/etc/caddy/Caddyfile
ssh root@vps 'systemctl daemon-reload && systemctl reload caddy'
```

Les certificats HTTPS sont obtenus et renouvelés automatiquement par Caddy dès
que le DNS du client pointe vers le serveur. Aucune intervention ensuite.

### Où se trouve quoi

- **Le contenu d'un client** : `clients/<slug>/site.json` — textes, horaires,
  prestations, statut. C'est le fichier que la console d'administration éditera
  en phase 2.
- **L'apparence d'un client** : `clients/<slug>/theme.json` — couleurs, polices,
  variantes de mise en page.
- **Le format de ces fichiers** : `packages/schema/src/index.ts`. Toute
  évolution commence là.
- **Le site lui-même** : `apps/template/src/`. Une modification ici touche tous
  les clients au prochain build — c'est voulu.

## 9. Indicateurs à suivre

| Indicateur | Pourquoi |
|---|---|
| Nombre de clients actifs | La base du récurrent. |
| MRR (revenu mensuel récurrent) | L'objectif réel du projet. |
| Taux de churn mensuel | Le risque n°1. À surveiller en priorité. |
| Temps de production par site | La marge en dépend directement. |
| Taux de transformation du porte-à-porte | Permet de calibrer l'effort commercial. |
| Coût d'infrastructure / MRR | Doit rester marginal. |

**Repère de réalité :** dix clients représentent environ 350-400 €/mois de
récurrent. C'est correct, mais au démarrage c'est le **setup** qui fait vivre,
pas le mensuel. Le récurrent devient significatif vers 25-30 clients. Il faut
donc raisonner en volume de setups au début ; la rente se construit derrière.
