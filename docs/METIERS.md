# Les métiers — ce qu'on sait faire, et ce qu'il reste à faire

Ce fichier répond à une seule question : **pour vendre un site à tel commerce,
qu'est-ce qui existe déjà et qu'est-ce qu'il faut écrire ?**

Il se lit dans cet ordre : la mécanique dont le métier a besoin (§2), ce que
tout site reçoit sans rien demander (§3), les sections qu'on lui ajoute (§4),
puis sa fiche (§5). Les chiffres de prospects viennent de l'inventaire
hub.brussels, extrapolés à la Région (§6).

> **État au 19 août 2026 : les seize métiers ci-dessous sont ouverts.** Les
> quatre mécaniques sont écrites et testées, y compris la carte et la demande
> de table. Ce qui reste à faire n'est plus du code, mais des **photos et des
> sites de démonstration** (§7).

---

## 1. Le principe : quatre mécaniques, pas quarante sites

Un métier **n'est pas un site de plus**. C'est une entrée dans
`packages/schema/src/metiers.ts` qui décide de cinq choses :

| Ce que le métier décide | Où ça s'applique |
|---|---|
| le **mode de commande** | rendez-vous, commande, table, ou rien |
| les **sections** affichées | au-delà du tronc commun |
| le **vocabulaire** | remplace les clés de `i18n.ts`, dans les trois langues |
| les **styles** proposés | la grille de la console et de l'espace commerçant |
| les **motifs** de remplacement | visuels générés tant qu'il n'y a pas de photos |

Le métier se **déduit** de `business.type` : il n'y a pas de champ « métier »,
parce que deux champs pour la même idée finiraient par se contredire.
`metierDe()` retombe sur `commerce` — vitrine — pour tout type inconnu.

**Le coût réel d'un métier n'est pas le code.** Une entrée dans `METIERS` tient
en une journée, tests compris. Ce qui coûte, c'est **le site de démonstration
avec de vraies photos** : sans lui, le commerçant ne se reconnaît pas, et on
lui montre un salon de coiffure en lui demandant d'imaginer sa boulangerie.

Quatre garde-fous tiennent l'ensemble cohérent, et échouent au test plutôt
qu'en clientèle :

- tout type du schéma est rangé dans un métier, et réciproquement ;
- tout type est proposé au formulaire de création de la console ;
- les styles d'un métier et les métiers d'un style disent la même chose ;
- aucun métier ne remplace une clé d'interface qui n'existe pas, et chaque clé
  est traduite dans les trois langues.

---

## 2. Les mécaniques

C'est la mécanique qui décide du coût. Un métier qui rentre dans une mécanique
existante coûte une journée ; un métier qui en demande une neuve coûte des
semaines.

### 2.1 `rendez-vous` — livrée

Créneaux calculés depuis la durée des prestations, agenda temps réel ou simple
demande, rappel par courriel la veille, annulation en un clic par le client,
fermetures qui bloquent la prise de rendez-vous.

*Pour tout métier qui vend du temps :* coiffure, beauté, onglerie, spa,
optique, toilettage, vétérinaire.

### 2.2 `commande` — livrée

Occasion, budget, date souhaitée, livraison ou retrait, adresse exigée dès
qu'il y a livraison, mot à recopier sur la carte. **Aucun paiement** : le
commerçant rappelle pour confirmer. Table `orders`, route `/v1/orders`,
courriel au commerce et accusé de réception au client, page « Mes commandes »
dans l'espace.

*Pour tout métier qui compose sur demande :* fleuriste, pâtisserie, traiteur,
chocolatier, boucherie, caviste — et le tatoueur, dont le « rendez-vous » est
en réalité une demande de projet.

### 2.3 `table` — livrée

Jour, heure, nombre de couverts, une note. Même route et même table en base que
la commande : c'est la même chose — une intention datée que le commerce
rappelle pour confirmer — avec deux champs de plus et deux de moins. Le
restaurateur la retrouve dans « Mes demandes de table ».

**Ce n'est pas un agenda de salle, et c'est délibéré.** Un restaurant sait
combien de couverts il peut prendre à 20 h un samedi ; un formulaire ne le sait
pas. Une table confirmée d'office qui n'existe pas lui coûte le client, et
l'avis qui suit. Le courriel et la page le disent en toutes lettres : rien
n'est retenu tant que le restaurant n'a pas répondu.

La disponibilité réelle par service viendra si elle se vend, pas avant.

### 2.4 `carte` — livrée

Une section à part entière : des groupes que le commerce découpe lui-même
(entrées, formule du midi, boissons…), un prix par ligne — qui peut manquer,
« selon arrivage » est une réponse — une description, et cinq régimes traduits
dans les trois langues (végétarien, vegan, sans gluten, épicé, fait maison).

Elle se modifie **par le commerçant lui-même**, page « Ma carte » : une ligne
par plat, avec le nom du groupe à côté. C'est ce qui décide si un restaurant
reste client — une carte qu'il faut nous demander de mettre à jour est une
carte qui ne changera jamais, et un abonnement résilié au bout de trois mois.

### 2.5 `planning` — livrée

Les cours de la semaine : jour, horaire, niveau, coach, places. Affiché, **pas
réservable**, et c'est un choix : le planning répond à la seule question qu'on
se pose avant de pousser la porte d'une salle — « qu'est-ce qu'il y a le mardi
soir ? ». L'inscription en ligne viendra si elle se vend.

### 2.6 `aucun` — vitrine, livrée

Téléphone, adresse, horaires, plan, photos, avis. C'est le repli, et il est
honnête : mieux vaut une vitrine soignée qu'un formulaire qui promet ce que le
commerce ne sait pas tenir.

---

## 3. Le tronc commun — ce que tout site reçoit

À énumérer au client : c'est ce que couvre le mensuel.

**Sur le site**
- une page d'accueil complète : accroche, photo de couverture, galerie, équipe,
  avis, horaires, plan, contact ;
- **barre d'action collante** sur mobile : appeler, et l'action principale du
  métier (réserver, commander, ou demander une table) ;
- **horaires + fermetures**, la fermeture en cours encadrée et remontée
  au-dessus de la grille, calculée dans le navigateur et jamais figée au build ;
- **une à trois langues** (FR/NL/EN selon le palier), URL par langue ;
- **mentions légales** belges, vérifiées automatiquement avant mise en ligne ;
- **données structurées** lues par Google : type de commerce, horaires, adresse,
  géolocalisation, prestations ;
- `sitemap.xml`, `robots.txt`, images en AVIF/WebP avec `srcset`, polices
  auto-hébergées, page 404 ;
- **15 styles** × **11 palettes**, filtrés par métier, tous passés aux contrôles
  de contraste ;
- **visuels de remplacement générés** tant que le client n'a pas fourni ses
  photos — avec un motif par métier : une tasse pour un café, une aiguille pour
  un tatoueur, un couvert pour un restaurant.

**Autour du site**
- **espace commerçant** : Je ferme, Mes horaires, Mes tarifs, **Ma carte**,
  **Mon planning**, Mes photos, Mon texte, Mon style, Mes rendez-vous *ou* Mes
  commandes *ou* Mes demandes de table, Mes messages ;
- **mesure d'audience maison**, sans cookie ni bandeau : vues, visiteurs,
  appels, itinéraires, demandes de rendez-vous, demandes de commande,
  provenances ;
- **rapport mensuel par courriel** — l'arme anti-résiliation ;
- **suspension automatique pour impayé**, abonnement Stripe, mandat SEPA ;
- sauvegardes, surveillance, déploiement par releases avec retour arrière.

---

## 4. Les sections optionnelles

Elles existent, elles sont testées, elles ne coûtent rien à réutiliser.

| Section | Ce qu'elle fait | Utilisée par |
|---|---|---|
| `prestations` | carte des services, prix exact ou « à partir de », durée facultative | la plupart |
| `carte` | plats et boissons groupés, prix, régimes, mot « la carte change » | restaurant, café, pâtisserie, traiteur |
| `planning` | les cours de la semaine, jour par jour, avec coach et places | salles de sport, studios |
| `occasions` | entrée par l'événement, photo, prix d'entrée, lien vers le formulaire **avec l'occasion préremplie** | fleuriste, pâtisserie, traiteur, chocolatier, boucherie, caviste, restaurant |
| `livraison` | zones, heure limite de commande, frais, franchise | fleuriste, métiers de bouche |
| `deuil` | section à part, sans prix ni formulaire, ligne téléphonique dédiée | fleuriste |
| `abonnement` | formules récurrentes, rythme, prix par livraison | fleuriste, caviste, traiteur, chocolatier |
| `equipe` | portraits, rôles ; sert aussi de capacité à l'agenda temps réel | tous |
| `deroule` | les étapes d'une prestation, se retire seule sous deux étapes | soins, tatouage |

---

## 5. Les seize métiers

Tous sont ouverts : vocabulaire traduit, sections choisies, styles filtrés,
motifs de remplacement. La colonne « démonstration » dit ce qui manque encore
pour vendre — c'est là qu'est le travail restant.

### 5.1 Rendez-vous

| Métier | `business.type` | Prospects | Sections | Démonstration |
|---|---|---|---|---|
| Coiffure, barbier, institut | `hair_salon`, `barbershop`, `beauty_salon` | ~870 + ~350 | prestations, equipe, deroule | ✅ `demo-barbier` |
| Onglerie, manucure | `nail_salon` | ~170 | prestations, equipe, deroule | à faire |
| Massage, spa | `day_spa`, `massage` | ~100 | prestations, equipe, deroule | à faire |
| Opticien | `optician` | ~190 | prestations, equipe, deroule | à faire |
| Toilettage, vétérinaire | `pet_grooming`, `veterinary` | à compter | prestations, equipe, deroule | à faire |

### 5.2 Commande

| Métier | `business.type` | Prospects | Sections | Démonstration |
|---|---|---|---|---|
| Fleuriste | `florist` | ~90 | occasions, prestations, deuil, abonnement, livraison, equipe | ✅ `demo-fleuriste` |
| Boulangerie, pâtisserie, glacier | `bakery`, `pastry_shop`, `ice_cream` | ~370 | occasions, prestations, carte, livraison, equipe | ✅ `demo-patisserie` |
| Chocolatier | `chocolate_shop` | ~340 | occasions, prestations, abonnement, livraison, equipe | à faire |
| Traiteur | `caterer` | ~100 | occasions, prestations, carte, livraison, abonnement, equipe | à faire |
| Boucherie, poissonnerie | `butcher`, `fishmonger` | ~150 + ~80 | occasions, prestations, livraison, equipe | à faire |
| Caviste, épicerie fine | `wine_store`, `deli` | ~80 + ~50 | occasions, prestations, abonnement, livraison, equipe | à faire |
| Tatouage, piercing | `tattoo_parlor` | ~80 | prestations, equipe, deroule | à faire |

**Le tatoueur est rangé dans la commande, contre l'apparence.** On ne réserve
pas une heure chez un tatoueur : on lui soumet un projet — emplacement, taille,
style, références — et c'est lui qui dit combien de séances il faut. Un agenda à
créneaux poserait la question dans le mauvais ordre, et le tatoueur passerait
ses journées à déplacer des rendez-vous pris pour la mauvaise durée.

### 5.3 Table, carte, planning

| Métier | `business.type` | Prospects | Sections | Démonstration |
|---|---|---|---|---|
| Restaurant | `restaurant` | **~2 940** | carte, occasions, livraison, equipe | ✅ `demo-restaurant` |
| Café, bar, salon de thé | `cafe`, `bar`, `tea_room` | **~1 670** | carte, equipe | ✅ `demo-cafe` |
| Salle de sport, yoga | `gym`, `yoga_studio` | ~190 | planning, prestations, equipe | ✅ `demo-salle` |

### 5.4 Le repli

`other` → vitrine complète : prestations et équipe. C'est aussi ce que reçoit
tout type inconnu, plutôt qu'une construction qui échoue.

### 5.5 Volontairement absents

Les **professions de santé réglementées** (médecins, dentistes, kinés,
psychologues) ne sont pas ouvertes. Leur communication est encadrée par leur
déontologie, et un site vendu sans connaître ces règles expose le praticien
plus qu'il ne l'aide. À rouvrir après avoir lu les règles, pas avant.

---

## 6. Les styles, par métier

Un style suppose un type de photographie. Les proposer tous à tout le monde
ferait choisir au commerçant celui qui convient le moins à ses images — et il
en conclurait, à juste titre, que son site est raté.

| Style | Ce qu'il évoque | Métiers |
|---|---|---|
| Maison | Blanc, filets fins, rien qui dépasse | soins, commerce, ongles, spa, opticien, animaux, pâtisserie, traiteur, café |
| Atelier | Barbier traditionnel, chaud, un peu d'usure | soins, commerce, animaux, tatouage, boucherie |
| Studio | Urbain, grandes capitales, contrastes | soins, commerce, opticien, tatouage, animaux, sport |
| Signature | Haut de gamme, grande photo, peu de texte | soins, commerce, ongles, spa, opticien, chocolatier, traiteur, restaurant, sport |
| Nuit | Fond sombre, surfaces vitrées, arrondis | soins, commerce, ongles, opticien, tatouage, restaurant, café, sport |
| Serre | Clair et végétal | fleuriste, spa |
| Nature morte | Fond sombre, sujet éclairé, très belge | fleuriste, chocolatier, caviste, restaurant |
| Marché | Chaleureux, direct, prix assumés | fleuriste, pâtisserie, boucherie |
| Herbier | Papier, petites capitales, presque un livre | fleuriste, chocolatier, traiteur, caviste |
| **Terrazzo** | **Café moderne, arrondis généreux, mosaïque — le style « instagrammable »** | café, restaurant, pâtisserie, sport |
| **Fournil** | Boulangerie, chaud, la vitrine avant le décor | pâtisserie, traiteur, boucherie, café |
| **Ganache** | Chocolatier, fond profond, cadrages serrés | chocolatier, caviste |
| **Comptoir** | Bistrot, ardoise, atmosphère du soir | restaurant, café, boucherie, caviste |
| **Pétale** | Onglerie, spa : doux, clair, arrondi | ongles, spa, animaux |
| **Flash** | Tatouage : planches au mur, capitales, trait dur | tatouage |

Onze palettes, ouvertes à tous les métiers — dont **Latte** (crème chaud) et
**Menthe** (vert pistache) ajoutées pour les métiers de bouche. Une couleur ne
suppose rien du contenu, à la différence d'une disposition.

---

## 7. Ce qu'il reste à faire

Ce n'est plus du code.

1. **Un domaine neutre.** Le domaine de service s'appelle `hairbxl.be` :
   montrer une démonstration de restaurant depuis `resto.hairbxl.be` coûte de
   la crédibilité à chaque rendez-vous. C'est le premier préalable, et le seul
   qui bloque vraiment la vente hors coiffure.
2. **Des photos.** Les six sites de démonstration tournent sur des visuels
   générés. Ils tiennent debout, mais une séance photo dans un vrai café vaut
   plus que trois métiers de plus.
3. **Une démonstration par métier restant** : chocolatier, traiteur, boucherie,
   caviste, onglerie, spa, opticien, tatouage, toilettage. Une demi-journée
   chacune, contenu compris — le code, lui, est déjà là.
4. **Enregistrer les commerces de démonstration** (`pnpm tenant demo-restaurant`,
   `demo-patisserie`) : sans commerce en base, ni le bouton ni le formulaire de
   demande ne s'affichent. `pnpm check` le signale désormais.
5. **DNS** pour les nouveaux sous-domaines de démonstration.

Plus tard, et seulement si ça se vend : la disponibilité réelle par service
pour les restaurants, et l'inscription en ligne aux cours.

---

## 8. Les chiffres, et ce qu'ils valent

Source : inventaire hub.brussels des commerces de la **Ville de Bruxelles**,
extrapolé à la Région par **×3,6** (la Ville pèse 27,5 % du parc régional).

**Le recoupement tient** : la coiffure donne 241 × 3,6 = 868, contre 824
relevés par une source indépendante. L'ordre de grandeur est bon ; le chiffre
exact ne l'est pas, et n'a pas besoin de l'être.

⚠️ La Ville de Bruxelles est le centre : elle **sur-représente** restaurants,
cafés et commerces touristiques, et **sous-représente** les services de
quartier. Pour ces derniers, le chiffre régional est un plancher.

**Ce que les chiffres disent vraiment :** le marché n'est jamais le facteur
limitant. La coiffure seule tient les 30 sites visés à 3,5 % de pénétration. Le
facteur limitant est le temps d'une seule personne — donc le bon critère n'est
pas « quel métier est le plus gros » mais **« quel métier coûte le moins de
jours par client gagné »**. Aujourd'hui que les seize entrées existent, ce coût
est le même partout : celui d'une démonstration crédible.
