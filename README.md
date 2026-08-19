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

| Palier | Setup | Mensuel | Adresse | Contenu |
|---|---|---|---|---|
| **Essentiel** | 490 € | 25 €/mois | `nom.hair.be` | One-page, mobile, photos, horaires, contact, plan, fiche Google. 1 langue. |
| **Pro** *(à pousser)* | 790 € | 39 €/mois | **son domaine** | Multi-pages, bilingue FR/NL, réservation en ligne, séance photo complète, Google optimisé + suivi. |
| **Signature** | 1 290 € | 59 €/mois | **son domaine** | Trilingue (+EN), réservation avancée, mini-boutique, shooting saisonnier, modifs illimitées. |

**Le nom de domaine est une caractéristique de palier** (§3.10). L'Essentiel
vit sur un sous-domaine du domaine de service ; le domaine propre commence au
Pro. Un client Essentiel qui veut le sien sans monter de palier le prend en
option — **+5 €/mois**, achat et renouvellement compris. Personne n'est bloqué,
et le Pro gagne un argument concret de plus.

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

**Le reste du commerce de proximité est ouvert depuis le 19 août 2026.**
Vingt-deux métiers, 54 types de commerce, quatre mécaniques, un vocabulaire et
des styles par métier : voir [docs/METIERS.md](docs/METIERS.md), qui fait foi
sur la question — y compris sur ce qui n'est **pas** couvert (§7 bis :
artisans du bâtiment, hôtellerie, garages, agences immobilières). Ce qui limite
la vente n'est plus le logiciel mais une démonstration crédible par métier.

**Ce paragraphe contredit ce que ce README disait jusqu'ici**, et c'est voulu.
Il déconseillait les restaurants (marges fines, patrons débordés, saturés par
TheFork) et les fleuristes (petites marges, saisonniers). Deux choses ont
changé :

- **les fleuristes** ont servi à éprouver la mécanique de commande, et le site
  livré a montré que le problème n'était pas la marge mais le devis — d'où un
  formulaire qui n'encaisse rien ;
- **les restaurants** sont le plus gros gisement de Bruxelles (~2 900), et leur
  besoin n'est pas une plateforme de réservation de plus : c'est **une carte à
  jour**, qu'ils modifient eux-mêmes le jeudi soir. C'est exactement ce que
  TheFork ne fait pas, et ce que la page « Ma carte » fait.

Reste vrai : un restaurant est un client plus difficile qu'un salon. On y va
avec des références en poche, pas en premier.

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
- Site rapide par défaut, ce qui se montre au prospect. Mesuré sur le site de
  démonstration, en local et sur un vrai navigateur : premier affichage à
  ~100 ms, aucun décalage de mise en page (CLS 0), 600 Ko pour le site entier
  dont 200 Ko de photos, une seule feuille de style de 22 Ko et 6 Ko de
  JavaScript. Aucun débordement horizontal ni défaut de contraste sur mobile
  comme sur bureau.

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
| `layout.gallery` | `grid` \| `mosaic` \| `strip` \| `marquee` | Disposition des photos. `marquee` fait défiler la galerie en continu (voir §3.3 quinquies). |
| `layout.nav` | `overlay` \| `solid` | Navigation par-dessus la photo, ou opaque. |
| `radius` | `none` \| `soft` \| `round` | `round` donne cartes arrondies et boutons en pilule. |
| `grain` | booléen | Grain photographique léger. |
| `effects.glass` | booléen | Surfaces translucides floutées. |
| `effects.blur` | 0–60 | Intensité du flou, en pixels. |
| `effects.reveal` | booléen | Les sections montent en fondu, au rythme du défilement (§3.3 quater). |
| `effects.parallax` | booléen | La photo du hero avance moins vite que la page (§3.3 quater). |

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

### 3.3 quater Le contenu qui monte vers le visiteur

**Décision :** l'apparition des sections et le recul de la photo du hero sont
**liés à la position de défilement**, pas déclenchés par elle. Deux réglages :
`effects.reveal` pour les sections, `effects.parallax` pour la photo.

**Pourquoi c'est différent d'une simple animation :** une apparition
déclenchée part à son propre rythme dès que l'élément entre à l'écran — elle se
joue *pendant* qu'on défile, sans rapport avec le geste. Ici, l'avancement de
l'animation **est** la position de l'élément dans la fenêtre. Le contenu monte
au rythme exact du doigt, s'arrête quand on s'arrête, redescend quand on
remonte. C'est ce qui donne la sensation que le contenu vient au visiteur au
lieu que le visiteur descende dans la page. Et la photo du hero, qui avance
moins vite que le reste, produit le même effet à plus grande échelle — là où
il compte le plus, puisque c'est la première chose que l'on voit.

**Comment, et ce que cela évite :**

- **Aucun JavaScript ne calcule quoi que ce soit.** Le navigateur lie
  l'animation au défilement (`animation-timeline`) et la compose sur le
  processeur graphique. Le script se contente de poser une classe.
- **Le défilement natif n'est jamais détourné.** L'autre façon d'obtenir cette
  sensation est d'intercepter la molette pour déplacer la page soi-même, avec
  inertie. C'est ce que font les bibliothèques du genre, et cela coûte cher :
  élan tactile cassé sur téléphone, défilement au clavier faussé, barre de
  défilement qui ment, et quelques dizaines de kilo-octets à charger. Pour un
  commerce dont l'essentiel du trafic est mobile, le prix est absurde.
- **Repli propre.** Les navigateurs sans cette liaison — Firefox à ce jour —
  gardent l'apparition classique déclenchée à l'entrée à l'écran. Même effet,
  moins lié au geste.
- **Rien ne peut rester masqué.** Sur une page trop courte pour défiler, la
  liaison est inactive et le contenu s'affiche normalement : vérifié sur les
  mentions légales et l'annulation, sur un écran de 2 000 px de haut.
- **Mouvement réduit demandé : tout s'arrête**, apparition comme parallaxe.

### 3.3 quinquies Le ruban défilant

**Décision :** `layout.gallery: "marquee"` fait défiler la galerie en continu,
sans fin ni bouton.

**Pourquoi :** c'est la signature visuelle des sites de coiffeurs et de
barbiers, et elle a un avantage concret au-delà du style. Une galerie en grille
demande de faire défiler la page ; une bande à faire glisser demande un geste
que personne ne fait. Le ruban, lui, se regarde sans rien manipuler, y compris
sur un téléphone tenu d'une main — et il montre le travail du salon, c'est-à-dire
exactement ce qui le vend.

**Comment, et pourquoi c'est fait ainsi :**

- **Deux copies identiques des photos** glissent d'exactement une demi-piste,
  puis l'animation repart de zéro. La reprise tombe sur une image identique et
  ne se voit pas.
- **Aucun JavaScript.** Le navigateur anime une seule transformation, sur le
  processeur graphique. Rien à charger, rien qui puisse échouer.
- **Toute la première série est chargée d'emblée.** Une image différée sur un
  ruban qui avance apparaît en blanc et se remplit sous les yeux du visiteur,
  au milieu du plus bel effet du site. La seconde série reprend les mêmes
  adresses : elle ne coûte rien.
- **Avec peu de photos, la série se répète** jusqu'à dépasser la largeur de
  l'écran — sans quoi le glissement laisserait un vide. `pnpm check` avertit
  en dessous de cinq photos : la répétition finit par se voir.
- **Le ruban s'arrête sous le curseur** ou dès qu'un élément voisin reçoit le
  focus. Une image qui fuit au moment où on la regarde est une image perdue.
- **Mouvement réduit demandé : le défilement s'arrête tout à fait**, et le
  ruban redevient une bande que l'on fait glisser soi-même. L'arrêter sans
  rendre la suite atteignable masquerait la moitié des photos.
- **Une photo n'est décrite qu'une fois** pour les lecteurs d'écran ; les
  répétitions sont marquées décoratives.

Les autres variantes restent disponibles : c'est un choix par client, pas une
nouvelle norme. Trente salons avec le même ruban se ressembleraient — ce que
§3.3 existe précisément pour éviter.

### 3.4 Caddy comme serveur web

**Décision :** Caddy, pas nginx.

**Pourquoi :** HTTPS Let's Encrypt automatique par domaine, renouvellement
inclus, aucun certbot à surveiller. Avec 30 domaines clients, c'est
l'automatisation qui compte le plus.

### 3.5 Déploiement par releases + symlink

Chaque déploiement écrit un nouveau dossier `releases/<horodatage>/` puis bascule
le symlink `current`. Bascule atomique, aucune coupure, rollback instantané.

### 3.5 bis Un module métier n'importe jamais la configuration du service

**Règle :** les modules qui portent la logique (agrégats d'audience, rapports,
abonnements, traitement des photos) reçoivent en argument ce dont ils ont
besoin — client de base de données, fonction d'envoi, racine du dépôt — au lieu
de l'importer.

**Pourquoi cette règle existe :** elle a été apprise quatre fois. Importer la
configuration du serveur dans un module de logique rendait la commande de
création de compte impossible à lancer sans secret de session, faisait planter
l'interface d'administration au démarrage parce qu'elle réclamait une clé
d'envoi de courriels, et empêchait d'écrire le moindre test sans monter tout
l'environnement. La contrainte est légère à respecter et coûteuse à réparer
après coup.

**Ce à quoi elle ressemble en pratique.** Le transport des courriels vit dans
`mail-transport.ts` : il ne lit aucune variable d'environnement, il reçoit ses
options. Chaque service en construit le sien à partir de sa propre
configuration — `apps/api/src/mail.ts` et `apps/admin/src/mail.ts`, quinze
lignes chacun. C'est ce qui permet à l'interface d'administration d'écrire aux
clients finaux sans charger la configuration de l'API, et de tester l'envoi
sans aucune variable d'environnement.

### 3.6 Git comme source de vérité du contenu

**Décision :** le contenu des sites (`site.json`, `theme.json`, médias) vit dans
git. Postgres ne stocke **que** les données transactionnelles : réservations,
clients finaux, facturation, audience.

**Pourquoi :** historique complet, rollback trivial, édition possible à la main
quand c'est plus rapide, et l'interface d'administration admin (§3.7) n'est qu'un éditeur qui
commit. Chaque outil à sa place.

### 3.7 Interface d'administration — mono-utilisateur, pilotage de tous les sites

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

**Fonctionnement :** l'interface d'administration écrit dans un clone du repo présent sur le VPS,
commit, push, puis déclenche le build et le déploiement du seul client modifié.
Git reste la source de vérité ; l'interface d'administration n'est qu'une interface d'écriture
confortable.

**Sécurité :** même avec un seul utilisateur, l'authentification est sérieuse —
mot de passe haché (argon2), 2FA TOTP, sessions à expiration, limitation du
nombre de tentatives. Cette console peut modifier et mettre hors ligne
l'intégralité des sites clients : c'est l'actif le plus sensible du projet.

**Ce que le formulaire structuré modifie, et pourquoi seulement cela :** statut,
coordonnées, horaires, tarifs et durées — ce qui change souvent et n'est pas
traduit. Les libellés traduits ne sont éditables que par l'éditeur JSON
intégré : un champ simplifié qui écraserait les versions néerlandaise et
anglaise ferait perdre du travail facturé, sans prévenir.

**Rendu en HTML côté serveur, sans framework d'interface.** C'est un outil
interne pour une seule personne : une application monopage y ajouterait un
build, des dépendances et une surface de maintenance pour une valeur nulle. Des
formulaires HTML suffisent, et fonctionnent depuis un téléphone en
déplacement.

**Séquencement :** livrée, mais elle ne remplace pas le terrain. À 3 sites,
éditer un JSON reste plus rapide que n'importe quelle interface ; l'interface d'administration
prend son sens vers 5-8 clients, quand le temps perdu en édition manuelle
devient réel.

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

- **v1 — demande de rendez-vous ✅ livrée.** Le client final choisit une
  prestation, une date et un moment de la journée ; le salon reçoit un
  courriel auquel il répond directement pour confirmer, et le client reçoit un
  accusé de réception dans sa langue. Aucun risque de double-réservation, et
  cela permet de **vendre le Premium immédiatement**.

  Le créneau demandé reste volontairement approximatif — matin, après-midi ou
  soirée. Laisser choisir une heure précise ferait croire à une réservation
  ferme alors que la confirmation est manuelle : la déception se paierait en
  appels et en avis négatifs.

  Le formulaire est rendu côté serveur avec les prestations du client et
  **fonctionne sans JavaScript** : le navigateur poste normalement et l'API
  renvoie vers la page. Une demande qui se perd parce qu'un script n'a pas
  chargé coûte bien plus cher qu'une page de confirmation moins élégante.

  La confirmation de ce chemin est affichée **par CSS**, via `:target` : l'API
  renvoie vers `#envoi-ok` ou `#envoi-ko`, et le bandeau correspondant se
  démasque. Elle était auparavant écrite en JavaScript — donc jamais montrée
  aux seuls visiteurs qui empruntent ce chemin. La promesse tenait dans le
  code, pas à l'écran.

  Quand l'adresse de retour annoncée par le formulaire ne correspond pas à
  l'origine enregistrée du commerce — un `www` de trop suffit — l'API retombe
  sur cette origine et journalise l'écart, au lieu de laisser le visiteur sur
  du JSON brut au domaine de l'API.
- **v2 — agenda temps réel ✅ livrée.** Le client voit les créneaux réellement
  libres et réserve fermement. Aucun prestataire externe : un service comme
  Salonkee coûterait 50-150 €/mois **au salon**, hébergerait son agenda chez un
  tiers, et ferait disparaître ce qui nous rend difficiles à remplacer.

  **La règle qui gouverne tout : le calcul propose, la base dispose.** Deux
  personnes peuvent voir le même créneau libre au même instant — c'est une
  contrainte d'exclusion Postgres (`exclude using gist`) qui tranche à
  l'écriture, et la seconde reçoit un refus propre au lieu d'un doublon.
  Vérifié : dix réservations simultanées sur un créneau à trois fauteuils
  donnent exactement trois succès, sur trois personnes distinctes.

  Un créneau n'est proposé que si la prestation tient **entièrement** avant la
  fermeture, et un délai de prévenance empêche de réserver pour dans dix
  minutes. Les horaires, prestations et congés sont projetés depuis git vers la
  base par `pnpm tenant` : git reste la source de vérité, la base n'en garde
  qu'une copie de travail que l'agenda peut lire à l'exécution.

  Cette partie exige JavaScript — des disponibilités qui changent d'une minute
  à l'autre ne se rendent pas en HTML statique. Le téléphone reste donc affiché
  et `<noscript>` le rappelle.
- **v3 — anti no-show (livrée).** Rappel par courriel entre 18 et 36 h avant le
  rendez-vous, et annulation en ligne en un clic. Voir §3.8 ter.

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

### 3.8 ter Absences — rappel par courriel et annulation en un clic

**Décision :** chaque rendez-vous porte un jeton d'annulation, envoyé dans le
courriel de confirmation puis rappelé la veille. Le client annule seul, sans
compte ni mot de passe. Pas de SMS.

**Pourquoi :** l'absence est le coût invisible d'un agenda en ligne. Un créneau
vide ne se revend pas, et c'est le salon qui le paie — donc, à terme, sa
confiance dans l'outil. Un rappel la veille réduit nettement les oublis, mais
l'essentiel est ailleurs : **il faut qu'annuler soit plus facile que ne pas
venir.** Un client qui annule à 18 h la veille rend un créneau vendable ; un
client qui ne se présente pas ne rend rien.

Les choix qui en découlent :

- **Le jeton tient lieu d'authentification.** Le connaître prouve qu'on a reçu
  le courriel. La page d'annulation n'expose donc rien de plus que ce courriel
  contenait déjà : prestation, date, prénom.
- **La page montre le rendez-vous avant de proposer d'annuler.** Annuler à
  l'aveugle est le meilleur moyen de supprimer le mauvais.
- **Fenêtre d'envoi de 18 à 36 h.** Assez large pour qu'une interruption du
  service ne fasse rien manquer, assez étroite pour ne pas prévenir trois jours
  à l'avance — un rappel trop tôt est un rappel oublié. `reminder_sent_at`
  garantit l'unicité de l'envoi, et n'est posé qu'après un envoi réussi : un
  échec est réessayé à la passe suivante.
- **Annulation refusée une fois l'heure passée.** Laisser annuler après coup
  effacerait l'absence des statistiques du salon — précisément ce qu'il a
  besoin de voir.
- **Le salon est prévenu de chaque annulation** : c'est un créneau qu'il peut
  revendre, et il ne le saura pas autrement.
- **Et réciproquement.** Quand le salon annule depuis l'agenda — un appel, une
  fermeture imprévue — le client reçoit un courriel dans sa langue avec le
  numéro à appeler. Sans lui, il se présenterait devant une porte fermée : pire
  qu'une absence, puisque c'est le commerce qui en porte l'image, sur l'outil
  qu'on lui a vendu. L'état précédent est relu avant d'écrire, pour ne pas
  annoncer deux fois la même annulation.
- **Pas de SMS.** Coût par envoi réel (~0,05 €), donc à répercuter ou à
  plafonner dans le mensuel, pour un gain marginal sur un public qui lit ses
  courriels. Écarté volontairement, réévaluable si les absences persistent.

Le créneau libéré redevient réservable immédiatement : la contrainte d'exclusion
ignore les rendez-vous annulés.

### 3.9 Édition de contenu par le client — non

Le client ne modifie rien lui-même. Les modifications passent par l'interface d'administration
(§3.7). **C'est un choix commercial, pas une limitation :** « vous ne touchez à
rien, je m'occupe de tout » est précisément ce qui est facturé dans le mensuel,
et cela évite qu'un commerçant casse la mise en page un vendredi soir.

Réévaluation possible vers 25-30 clients avec un CMS git-based (Decap), qui se
branche sur du statique sans backend. Le format de données est conçu pour rendre
ce branchement trivial le jour venu.

### 3.10 L'adresse du site — sous-domaine par défaut, domaine propre au Pro

**Décision :** tout client démarre sur un sous-domaine du domaine de service —
`kevincoiffure.hair.be`. Le domaine propre est une **caractéristique du palier
Pro**, ou une option à +5 €/mois sur l'Essentiel. Quand un client en prend un,
il est enregistré **à son nom**.

**Pourquoi cette bascule.** La version précédente de ce document imposait le
domaine propre à tout le monde, au motif qu'un sous-domaine enfermerait le
client. L'argument ne tient pas : il ne vaut que si le sous-domaine est imposé
en silence. **Annoncé comme une caractéristique de palier, ce n'est plus un
piège mais un choix** — le commerçant sait ce qu'il prend et peut monter quand
il veut. C'est le modèle de Shopify, Wix et Squarespace, et il fonctionne.

Ce que la bascule apporte concrètement :

- **Un argument de vente de plus pour le Pro**, le palier qu'il faut pousser.
  « Votre propre adresse » est compréhensible en trois secondes sur un pas de
  porte, contrairement au bilingue ou à l'agenda.
- **Zéro friction à la signature.** Le site est en ligne dans l'heure, sans
  attendre l'achat d'un domaine, ni la propagation DNS, ni de savoir si le
  commerçant possède déjà quelque chose chez un cousin webmaster.
- **Une objection prix désamorcée.** « Ça vous économise le domaine » est une
  phrase que le commerçant entend, même si le montant est petit.
- **Moins d'administratif** : un domaine à surveiller au lieu de trente
  échéances de renouvellement dispersées.

**Ce que cela coûte, et qui est assumé :**

- **Réputation partagée.** Un client problématique atteint le domaine entier.
  Peu probable sur des coiffeurs, mais c'est le vrai risque, et il n'a pas de
  parade technique — seulement le choix des clients.
- **L'adresse e-mail.** `contact@kevincoiffure.be` reste impossible tant que le
  commerçant n'a pas son domaine. À utiliser comme argument de montée en
  gamme plutôt que de le subir.
- **Une migration à faire proprement** le jour où un client passe au Pro. C'est
  prévu : voir ci-dessous.

**La migration ne casse rien.** Le nouveau domaine devient `domain`, l'ancien
sous-domaine passe dans `aliases`, et `pnpm caddy` produit une **redirection
permanente** qui conserve le chemin. Les signets des clients du salon
continuent de fonctionner, et le référencement se transfère au lieu de se
disperser entre deux adresses.

```json
{
  "domain": "kevincoiffure.be",
  "aliases": ["kevincoiffure.hair.be", "www.kevincoiffure.be"]
}
```

**Le domaine reste au nom du commerçant** quand il en prend un. Le verrouiller
à son propre nom crée un conflit juridique le jour où la relation se termine
mal, pour 12 € par an. Le verrouillage doit venir de la qualité du service.

### 3.11 Suspension pour impayé, prévue dès le départ

Un drapeau `suspended: true` dans `site.json` déploie une page « site
temporairement indisponible ». Deux lignes de code maintenant ; une improvisation
dans l'urgence si on l'oublie.

### 3.12 Encaissement — abonnements Stripe

**Décision :** abonnements Stripe Billing, en prélèvement SEPA avec la carte en
secours.

**Pourquoi ça débloque tout :** prélever sur le compte d'un tiers exige
normalement un contrat créancier auprès de sa banque et un identifiant
créancier — frais d'ouverture, frais mensuels, souvent un volume minimum, et
rien de tout cela ne se fait depuis une application bancaire. Avec Stripe,
**c'est Stripe qui est le créancier du mandat** : ni contrat bancaire, ni
identifiant, ni frais fixes. Le commerçant signe une fois en ligne, et le
prélèvement tourne seul.

**SEPA d'abord, carte en secours :** le prélèvement coûte moins cher et
n'expire pas. Une carte qui expire au bout de trois ans casse la rente sans
prévenir — exactement ce qu'on cherche à éviter.

**Les notifications Stripe sont la source de vérité.** On ne décide jamais
qu'un client est à jour : Stripe le dit. Interroger l'API à la demande donnerait
une photo, alors que l'important est d'être prévenu quand un prélèvement
échoue.

**Quand suspendre :** aux statuts `past_due` et `unpaid`, c'est-à-dire une fois
que Stripe a épuisé ses propres relances. Suspendre au premier échec couperait
le site d'un client dont la carte a simplement expiré. Un mandat encore non
signé (`incomplete`) n'est pas non plus un impayé.

### 3.13 Mesure d'audience — collecte maison (arme anti-churn)

**Décision révisée.** Le plan initial prévoyait Umami auto-hébergé. La collecte
est finalement intégrée à l'API existante.

**Pourquoi ce changement :** ce qui a de la valeur ici n'est pas un tableau de
bord — il ne serait presque jamais ouvert — mais le **message mensuel envoyé au
commerçant**. Or ce message repose sur des événements précis (clics sur le
téléphone, demandes d'itinéraire, demandes de rendez-vous) qu'il aurait fallu
instrumenter à la main dans Umami de toute façon. La base et l'API existaient
déjà : un service de plus à maintenir, sauvegarder et mettre à jour ne se
justifiait pas.

**Ce qui est mesuré :** pages vues, visiteurs distincts, part de téléphone,
appels, itinéraires, demandes de rendez-vous, messages, provenances.

**Vie privée, et pourquoi c'est aussi un argument commercial :** aucun cookie,
aucun stockage sur l'appareil du visiteur, aucune adresse IP conservée. Un
visiteur est compté via une empreinte non réversible mêlant son adresse, son
navigateur et un **sel qui change chaque jour** — elle permet de compter des
visiteurs uniques sur une journée et devient inexploitable le lendemain, y
compris pour nous. Conséquence directe : **pas de bandeau de consentement**, ce
qui préserve le design des sites et évite une friction à chaque visite.

**Le livrable :** le rapport part **automatiquement** par courriel au
commerçant, dans sa langue, à partir du 2 de chaque mois. La date n'est pas le
1er parce que les événements de la veille peuvent encore arriver, et un rapport
amputé de son dernier jour se remarque. L'envoi est idempotent — un redémarrage
du service ne peut pas expédier deux fois le même mois — et un mois sans la
moindre visite n'envoie rien : annoncer « 0 visiteur » à quelqu'un qui paie est
le meilleur moyen de lui donner envie de résilier. L'interface permet aussi de
consulter et de renvoyer un mois à la main. C'est **ça** qui empêche la
résiliation au bout de huit mois — il voit ce qu'il achète. Un tableau de bord
ne produit pas cet effet.

**La balise part en `text/plain`, et c'est délibéré.** Écrite d'abord en
`application/json`, elle n'a jamais rien enregistré : le navigateur exige pour
ce type une requête préalable et une autorisation d'identifiants qu'une balise
ne peut pas obtenir, dès lors que l'API vit sur un autre domaine que le site —
c'est-à-dire en production, toujours. Le contenu reste du JSON, seule
l'étiquette change, et l'API sait la lire.

La panne était parfaitement muette : aucune erreur côté serveur, une page qui
fonctionne, et une table `page_events` vide. Elle a survécu à plusieurs
vérifications parce que celles-ci passaient par `curl`, qui ignore les règles
d'origine du navigateur. **Une fonctionnalité qui ne vit que dans un navigateur
doit être vérifiée dans un navigateur** — c'est la deuxième fois que cette
leçon coûte cher, après l'envoi des formulaires en `multipart`.

**Umami reste une option** si un vrai tableau de bord devient nécessaire : les
deux peuvent coexister, le site n'aurait qu'un script de plus.

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
│  └─ console/             # Interface d'administration + API réservation (Node/TS + Postgres)
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
/srv/repo/                        # clone utilisé par l'interface d'administration
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

Sur push vers `main` : `pnpm typecheck`, `pnpm test` et `pnpm check`, puis
détection des clients modifiés, build de ceux-là uniquement (ou de tous si
`apps/template` a changé), enfin `rsync` vers le VPS par clé SSH stockée en
secret GitHub.

Les trois contrôles passent **avant** le build, et dans cet ordre : une erreur
de type ne se voit qu'à l'exécution (Node efface les types sans les lire), un
test rouge signale une régression métier, et `pnpm check` attrape ce qui casse
un site en particulier. Sur un monorepo où un template fautif casse trente
sites d'un coup, c'est la contrepartie du §3.1.

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
| « C'est quoi cette adresse, `.hair.be` ? » | C'est votre adresse, comme une boîte aux lettres dans un immeuble bien tenu — et ça vous économise l'achat et la gestion d'un domaine. Si vous en voulez un à votre nom, c'est le pack Pro, ou 5 € de plus par mois. |
| « Je veux mon propre nom de domaine » | Parfait, c'est compris dans le Pro. *(Ne pas brader : c'est l'argument le plus compréhensible pour faire monter d'un palier.)* |

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

### Le risque de l'interface d'administration

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

### Phase 2 — Passage à l'échelle du contenu *(partiellement livrée)*

- [x] Interface d'administration (`apps/admin`) : liste des clients, édition par
      formulaires, éditeur JSON, publication en un bouton, suivi des demandes
      de rendez-vous.
- [x] Authentification à deux facteurs (mot de passe scrypt + TOTP), sessions
      signées, protection globale par crochet, journal des publications.
- [x] Drapeau de suspension opérationnel de bout en bout.
- [x] Envoi et suppression de photos depuis l'interface, avec réduction et
      conversion automatiques à l'arrivée.
- [x] Mesure d'audience sans cookie, rapport mensuel prêt à envoyer **et
      envoyé automatiquement** au commerçant.
- [x] Abonnements Stripe : création du mandat, suivi des impayés, page
      Abonnements dans l'interface.

**Mise en service :**

```bash
# Sur le VPS, une fois le dépôt cloné dans /srv/repo
cd infra && docker compose up -d          # db + api + console
docker compose exec admin node --experimental-strip-types \
  src/cli/create-admin.ts                 # compte + secret TOTP
scp infra/admin.caddy root@vps:/etc/caddy/sites/   # après avoir mis le domaine
```

Le bloc Caddy de l'interface contient un filtre par adresse IP, commenté :
l'activer réduit fortement la surface exposée de l'outil le plus sensible du
projet.

### Phase 3 — Réservation v1 ✅ *(débloque la vente du Premium)*

- [x] `apps/api` : Fastify + Postgres, migrations appliquées au démarrage.
- [x] Demande de rendez-vous : prestation, date, moment de la journée.
      Courriel au salon (réponse directe au client) et accusé de réception
      traduit au client final.
- [x] Formulaire de contact servi par la même API.
- [x] Formulaires rendus côté serveur, fonctionnels sans JavaScript.
- [x] Protections : limitation de débit par IP, piège à robots, CORS limité aux
      domaines des clients, redirection de retour vérifiée contre l'origine
      déclarée.
- [x] Purge automatique des données au-delà de la durée de conservation.
- [x] `docker-compose.yml`, `Dockerfile` et bloc Caddy de l'API.

Reste, hors code : **signer un DPA avec chaque commerçant** utilisant la
réservation, et tenir le registre des traitements. L'API stocke des données
personnelles de clients finaux dès la première demande.

**Mise en service :**

```bash
# Sur le VPS
cd infra && docker compose up -d          # api + postgres
scp infra/api.caddy root@vps:/etc/caddy/sites/   # après avoir mis le domaine

# En local, pour chaque client
pnpm tenant salon-marie --email salon@exemple.be
# puis passer booking.mode à "request" dans site.json
PUBLIC_API_URL=https://api.exemple.be pnpm build salon-marie
```

### Phase 4 — Réservation v2 ✅

- Agenda temps réel, disponibilités calculées, confirmation automatique.
- Gestion de la concurrence en base (contrainte d'exclusion, §3.8).
- Interface agenda dans l'interface d'administration.
- Parcours de réservation par étapes, pensé pour le téléphone.

### Phase 5 — Consolidation *(en cours)*

- ✅ Anti no-show : rappel par courriel et annulation en ligne (§3.8 ter). Le
  SMS est écarté volontairement.
- ✅ Vérification des types du monorepo (`pnpm typecheck`) — Node exécute les
  `.ts` sans jamais les relire, ce contrôle est donc le seul qui les regarde.
- Mise en ligne sur le VPS : images Docker, Caddy, sauvegardes, supervision.
  Rien de tout cela n'a encore tourné sur une vraie machine. La procédure
  complète, pas à pas, est dans **`docs/DEPLOIEMENT.md`** — avec la liste de ce
  qui n'a jamais été essayé et qu'il faut vérifier ce jour-là.
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
| `pnpm typecheck` | Relit les types du code Node et du template. Node n'effectue aucune vérification à l'exécution : sans cette commande, personne ne les regarde. |
| `pnpm test` | Suite de tests (vitest). |
| `pnpm caddy <slug>` | Génère le bloc Caddy du client : le site sur son domaine, une redirection permanente pour chaque alias. |
| `pnpm placeholders <slug>` | Régénère les visuels de remplacement. |
| `pnpm tenant <slug> --email …` | Enregistre le commerce auprès de l'API et génère son `tenantId`. |
| `pnpm api` | Lance l'API de réservation en local. |
| `pnpm admin` | Lance l'interface d'administration en local. |
| `pnpm admin:create` | Crée le compte d'administration et son secret TOTP. |
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
  prestations, statut. C'est le fichier que la interface d'administration éditera
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
