/**
 * Les métiers.
 *
 * Un site de fleuriste n'est pas un site de coiffeur recoloré. Ce qu'il vend
 * change chaque semaine au gré des saisons, son client entre par l'occasion —
 * mariage, deuil, naissance — et non par la prestation, et sa question la plus
 * fréquente est « livrez-vous chez moi, et jusqu'à quelle heure ? ». Aucune de
 * ces trois choses n'existe chez un coiffeur.
 *
 * Ce fichier décrit ces différences en un seul endroit. Tout le reste — le
 * vocabulaire du site, les sections affichées, les styles proposés, les visuels
 * de remplacement, les pages de l'espace commerçant — les lit ici.
 *
 * ─── Le métier n'est pas un champ de plus ─────────────────────────────────
 *
 * Il se **déduit** de `business.type`, qui existe déjà et qui part dans les
 * données structurées lues par Google. Deux champs pour la même idée finiraient
 * par se contredire : un `site.json` disant « fleuriste » d'un côté et
 * « HairSalon » de l'autre, sans que rien ne le signale, et un commerce
 * introuvable dans les recherches qui comptent pour lui.
 *
 * ─── Un métier coûte une entrée, pas un site ──────────────────────────────
 *
 * Ouvrir un métier n'est pas le rendre possible : tout commerce est déjà
 * vendable en vitrine. C'est le rendre **juste** — ses mots, ses sections, ses
 * styles. Quatre mécaniques suffisent à couvrir le commerce de proximité :
 * on prend rendez-vous, on commande, on réserve une table, ou rien de tout
 * cela. Le reste n'est que vocabulaire.
 */

/** Ce qui remplace la prise de rendez-vous, quand elle n'a pas de sens. */
export type ModeCommande =
  /** Créneaux, durées, agenda temps réel. Coiffure, soins. */
  | "rendez-vous"
  /**
   * Demande de commande : occasion, budget, date, livraison ou retrait. Le
   * commerçant répond. Aucun paiement en ligne — un fleuriste ne peut pas
   * promettre à l'avance ce qu'il pourra composer avec l'arrivage du jour.
   */
  | "commande"
  /**
   * Demande de table : date, heure, nombre de couverts. Même machinerie que
   * la commande — une intention que le commerce confirme — mais sans occasion
   * ni adresse, et avec deux champs qui n'existent nulle part ailleurs.
   *
   * Ce n'est volontairement pas un agenda : un restaurant sait combien de
   * couverts il peut prendre, un formulaire ne le sait pas, et une table
   * confirmée d'office qui n'existe pas coûte plus cher qu'un rappel.
   */
  | "table"
  /** Ni l'un ni l'autre : téléphone, adresse, horaires. */
  | "aucun";

/** Les sections qu'un métier peut afficher, au-delà du tronc commun. */
export const SECTIONS_METIER = [
  "prestations",
  "occasions",
  "livraison",
  "deuil",
  "abonnement",
  "equipe",
  "deroule",
  /** La carte : plats ou boissons groupés par service, avec leurs prix. */
  "carte",
  /** Le planning : des cours à horaire fixe, capacité partagée. */
  "planning",
] as const;

export type SectionMetier = (typeof SECTIONS_METIER)[number];

export interface Metier {
  id: string;
  nom: string;
  /** Types de commerce que ce métier recouvre. */
  types: readonly string[];
  commande: ModeCommande;
  sections: readonly SectionMetier[];
  /** Styles proposés à ce métier, par identifiant. */
  styles: readonly string[];
  /** Motifs des visuels de remplacement (voir scripts/gen-placeholders.ts). */
  motifs: readonly string[];
  /**
   * Vocabulaire propre au métier : ces clés remplacent celles de `i18n.ts`.
   * Une clé absente retombe sur le libellé commun — c'est ce qui permet
   * d'ajouter un métier sans traduire deux cents chaînes.
   */
  vocabulaire: Record<string, Partial<Record<"fr" | "nl" | "en", string>>>;
}

export const METIERS: Record<string, Metier> = {
  /*
   * Coiffure, barbier, institut. Le métier d'origine : on prend rendez-vous,
   * la prestation a une durée, et cette durée commande les créneaux.
   */
  soins: {
    id: "soins",
    nom: "Coiffure, barbier, institut",
    types: ["hair_salon", "barbershop", "beauty_salon"],
    commande: "rendez-vous",
    sections: ["prestations", "equipe", "deroule"],
    styles: ["maison", "atelier", "studio", "signature", "nuit"],
    motifs: ["silhouette", "ciseaux", "peigne", "fut", "blaireau", "rayures"],
    vocabulaire: {},
  },

  /*
   * Onglerie, manucure. Même mécanique que la coiffure, à un mot près : on ne
   * montre pas « le salon » mais ce qui en sort. Une cliente choisit sur une
   * photo de mains, pas sur une photo de fauteuil.
   */
  ongles: {
    id: "ongles",
    nom: "Onglerie, manucure",
    types: ["nail_salon"],
    commande: "rendez-vous",
    sections: ["prestations", "equipe", "deroule"],
    styles: ["petale", "maison", "signature", "nuit"],
    motifs: ["silhouette", "petale", "rayures"],
    vocabulaire: {
      gallery_title: { fr: "Nos réalisations", nl: "Ons werk", en: "Our work" },
      cta_title: {
        fr: "Prendre soin de vos mains ?",
        nl: "Tijd voor uw handen?",
        en: "Time for your hands?",
      },
    },
  },

  /*
   * Massage, spa, soins du corps. La prestation se vend par ce qu'elle
   * apporte, pas par ce qu'elle fait : « nos soins », jamais « nos
   * prestations », et un lieu photographié vide plutôt qu'en activité.
   */
  spa: {
    id: "spa",
    nom: "Massage, spa",
    types: ["day_spa", "massage"],
    commande: "rendez-vous",
    sections: ["prestations", "equipe", "deroule"],
    styles: ["petale", "serre", "maison", "signature"],
    motifs: ["silhouette", "petale", "feuillage"],
    vocabulaire: {
      services_title: { fr: "Nos soins", nl: "Onze behandelingen", en: "Our treatments" },
      gallery_title: { fr: "Le lieu", nl: "De ruimte", en: "The space" },
      team_title: { fr: "Vos praticiens", nl: "Uw therapeuten", en: "Your therapists" },
      cta_title: {
        fr: "Envie d'une parenthèse ?",
        nl: "Zin in een pauze?",
        en: "Ready to unwind?",
      },
      book: { fr: "Réserver un soin", nl: "Behandeling boeken", en: "Book a treatment" },
      book_short: { fr: "Réserver", nl: "Boeken", en: "Book" },
    },
  },

  /*
   * Opticien. On y prend rendez-vous pour un examen de vue, mais l'essentiel
   * du site reste une vitrine : les montures se choisissent sur place.
   */
  opticien: {
    id: "opticien",
    nom: "Opticien",
    types: ["optician"],
    commande: "rendez-vous",
    sections: ["prestations", "equipe", "deroule"],
    styles: ["maison", "studio", "signature", "nuit"],
    motifs: ["lunettes", "silhouette", "rayures"],
    vocabulaire: {
      services_title: { fr: "Nos services", nl: "Onze diensten", en: "Our services" },
      gallery_title: { fr: "La boutique", nl: "De winkel", en: "The shop" },
      team_title: { fr: "Vos opticiens", nl: "Uw opticiens", en: "Your opticians" },
      cta_title: { fr: "Un examen de vue ?", nl: "Een oogmeting?", en: "An eye test?" },
    },
  },

  /*
   * Toilettage, vétérinaire. Le client n'est pas celui qu'on soigne, et le
   * vocabulaire doit le dire : on prend soin de son animal, pas de lui.
   */
  animaux: {
    id: "animaux",
    nom: "Toilettage, vétérinaire",
    types: ["pet_grooming", "veterinary"],
    commande: "rendez-vous",
    sections: ["prestations", "equipe", "deroule"],
    styles: ["maison", "atelier", "petale", "studio"],
    motifs: ["patte", "silhouette", "rayures"],
    vocabulaire: {
      gallery_title: { fr: "Le cabinet", nl: "De praktijk", en: "The practice" },
      cta_title: {
        fr: "Prendre soin de votre animal ?",
        nl: "Zorgen voor uw dier?",
        en: "Care for your pet?",
      },
    },
  },

  /*
   * Tatouage, piercing.
   *
   * Rangé dans la commande et non dans le rendez-vous, contre l'apparence :
   * on ne réserve pas une heure chez un tatoueur, on lui soumet un projet —
   * emplacement, taille, style, références — et c'est lui qui dit combien de
   * séances il faut. Un agenda à créneaux poserait la question dans le
   * mauvais ordre, et le tatoueur passerait ses journées à déplacer des
   * rendez-vous pris pour la mauvaise durée.
   */
  tatouage: {
    id: "tatouage",
    nom: "Tatouage, piercing",
    types: ["tattoo_parlor"],
    commande: "commande",
    sections: ["prestations", "equipe", "deroule"],
    styles: ["flash", "studio", "nuit", "atelier"],
    motifs: ["aiguille", "silhouette", "rayures"],
    vocabulaire: {
      services_title: { fr: "Nos tarifs", nl: "Onze tarieven", en: "Our rates" },
      gallery_title: { fr: "Le book", nl: "Het portfolio", en: "The portfolio" },
      team_title: { fr: "Les tatoueurs", nl: "De tatoeëerders", en: "The artists" },
      cta_title: {
        fr: "Un projet en tête ?",
        nl: "Een project in gedachten?",
        en: "A project in mind?",
      },
      book: { fr: "Décrire mon projet", nl: "Mijn project beschrijven", en: "Describe my project" },
      book_short: { fr: "Mon projet", nl: "Mijn project", en: "My project" },
      order_title: { fr: "Votre projet de tatouage", nl: "Uw tattooproject", en: "Your tattoo project" },
      order_intro: {
        fr: "Décrivez ce que vous avez en tête. Nous vous répondons pour convenir d'un rendez-vous. Aucun paiement ici.",
        nl: "Beschrijf wat u in gedachten hebt. Wij antwoorden om een afspraak vast te leggen. Geen betaling hier.",
        en: "Describe what you have in mind. We reply to arrange an appointment. No payment here.",
      },
      order_occasion: { fr: "Le style", nl: "De stijl", en: "The style" },
      order_card: { fr: "Votre projet", nl: "Uw project", en: "Your project" },
      order_card_help: {
        fr: "Emplacement, taille en centimètres, références.",
        nl: "Plaats, grootte in centimeter, referenties.",
        en: "Placement, size in centimetres, references.",
      },
      order_send: { fr: "Envoyer mon projet", nl: "Mijn project versturen", en: "Send my project" },
    },
  },

  /*
   * Fleuriste.
   *
   * Trois renversements par rapport à la coiffure, et ce sont eux qui
   * justifient tout ce fichier :
   *
   *  - on ne réserve pas un créneau, on commande un bouquet ;
   *  - le catalogue n'est pas une carte de prestations mais des collections
   *    saisonnières, dont le prix se dit « à partir de » ;
   *  - le client cherche par occasion, et la plus urgente de toutes — le deuil
   *    — ne se présente pas sur le même ton que le reste.
   */
  fleuriste: {
    id: "fleuriste",
    nom: "Fleuriste",
    types: ["florist"],
    commande: "commande",
    sections: ["occasions", "prestations", "deuil", "abonnement", "livraison", "equipe"],
    styles: ["serre", "naturemorte", "marche", "herbier"],
    motifs: ["fleur", "feuillage", "vase", "bouquet", "ruban", "graine"],
    vocabulaire: {
      services_title: { fr: "Nos compositions", nl: "Onze creaties", en: "Our arrangements" },
      gallery_title: { fr: "L'atelier", nl: "Het atelier", en: "The workshop" },
      team_title: { fr: "Qui compose vos fleurs", nl: "Wie uw bloemen schikt", en: "Who arranges your flowers" },
      cta_title: { fr: "Une occasion à fleurir ?", nl: "Iets te vieren?", en: "An occasion to celebrate?" },
      book: { fr: "Commander", nl: "Bestellen", en: "Order" },
      book_short: { fr: "Commander", nl: "Bestellen", en: "Order" },
      steps_title: { fr: "Comment on travaille", nl: "Hoe we werken", en: "How we work" },
    },
  },

  /*
   * Boulangerie, pâtisserie, glacier.
   *
   * Le métier le plus proche du fleuriste, et c'est pourquoi il vient juste
   * après : on commande à l'avance pour une date, l'occasion porte la demande,
   * et le mot de la carte devient le message écrit sur le gâteau. Le pain
   * quotidien ne se commande pas en ligne — la pièce de fête, si, et c'est
   * elle qui fait la marge.
   */
  patisserie: {
    id: "patisserie",
    nom: "Boulangerie, pâtisserie",
    types: ["bakery", "pastry_shop", "ice_cream"],
    commande: "commande",
    sections: ["occasions", "prestations", "carte", "livraison", "equipe"],
    styles: ["fournil", "terrazzo", "maison", "marche"],
    motifs: ["epi", "gateau", "rayures"],
    vocabulaire: {
      services_title: { fr: "Nos gâteaux", nl: "Onze taarten", en: "Our cakes" },
      gallery_title: { fr: "La boutique", nl: "De winkel", en: "The shop" },
      team_title: { fr: "Qui pâtisse", nl: "Wie er bakt", en: "Who bakes" },
      cta_title: { fr: "Un gâteau à commander ?", nl: "Een taart bestellen?", en: "A cake to order?" },
      book: { fr: "Commander", nl: "Bestellen", en: "Order" },
      book_short: { fr: "Commander", nl: "Bestellen", en: "Order" },
      order_title: { fr: "Commander un gâteau", nl: "Een taart bestellen", en: "Order a cake" },
      order_card: {
        fr: "Message à écrire sur le gâteau",
        nl: "Boodschap op de taart",
        en: "Message on the cake",
      },
      order_card_help: {
        fr: "Nous l'écrivons à la main.",
        nl: "Wij schrijven het met de hand.",
        en: "We write it by hand.",
      },
    },
  },

  /*
   * Chocolatier. La même mécanique que la pâtisserie, mais l'année entière
   * tient dans quatre dates : Saint-Valentin, Pâques, Saint-Nicolas, Noël.
   * D'où l'entrée par les occasions, et l'abonnement pour les coffrets
   * d'entreprise, qui sont le seul revenu récurrent du métier.
   */
  chocolatier: {
    id: "chocolatier",
    nom: "Chocolatier",
    types: ["chocolate_shop"],
    commande: "commande",
    sections: ["occasions", "prestations", "abonnement", "livraison", "equipe"],
    styles: ["ganache", "naturemorte", "signature", "herbier"],
    motifs: ["carre", "ruban", "rayures"],
    vocabulaire: {
      services_title: { fr: "Nos chocolats", nl: "Onze pralines", en: "Our chocolates" },
      gallery_title: { fr: "L'atelier", nl: "Het atelier", en: "The workshop" },
      team_title: { fr: "Qui les fabrique", nl: "Wie ze maakt", en: "Who makes them" },
      cta_title: { fr: "Un ballotin sur mesure ?", nl: "Een ballotin op maat?", en: "A custom box?" },
      book: { fr: "Commander", nl: "Bestellen", en: "Order" },
      book_short: { fr: "Commander", nl: "Bestellen", en: "Order" },
      order_title: { fr: "Commander des chocolats", nl: "Chocolade bestellen", en: "Order chocolates" },
      subscription_title: {
        fr: "Des chocolats chaque mois",
        nl: "Elke maand chocolade",
        en: "Chocolates every month",
      },
      subscription_intro: {
        fr: "Pour un bureau, un client, ou pour soi.",
        nl: "Voor een kantoor, een klant, of voor uzelf.",
        en: "For an office, a client, or for yourself.",
      },
    },
  },

  /*
   * Traiteur. Le panier le plus élevé de tous, et le seul métier dont le
   * client est souvent une société : le mensuel du site ne s'y discute pas.
   * La demande n'est pas une commande mais un devis — on ne connaît ni le
   * nombre de convives ni le lieu avant d'avoir parlé.
   */
  traiteur: {
    id: "traiteur",
    nom: "Traiteur",
    types: ["caterer"],
    commande: "commande",
    sections: ["occasions", "prestations", "carte", "livraison", "abonnement", "equipe"],
    styles: ["signature", "herbier", "fournil", "maison"],
    motifs: ["couvert", "epi", "rayures"],
    vocabulaire: {
      services_title: { fr: "Nos formules", nl: "Onze formules", en: "Our packages" },
      gallery_title: { fr: "Nos tables", nl: "Onze tafels", en: "Our tables" },
      team_title: { fr: "L'équipe en cuisine", nl: "Het keukenteam", en: "The kitchen team" },
      cta_title: {
        fr: "Un événement à préparer ?",
        nl: "Een evenement te plannen?",
        en: "An event to plan?",
      },
      book: { fr: "Demander un devis", nl: "Offerte aanvragen", en: "Request a quote" },
      book_short: { fr: "Un devis", nl: "Offerte", en: "Get a quote" },
      order_title: { fr: "Demander un devis", nl: "Een offerte aanvragen", en: "Request a quote" },
      order_intro: {
        fr: "Dites-nous la date, le nombre de convives et l'esprit. Nous revenons vers vous avec une proposition. Aucun paiement ici.",
        nl: "Vertel ons de datum, het aantal gasten en de sfeer. Wij komen bij u terug met een voorstel. Geen betaling hier.",
        en: "Tell us the date, the number of guests and the mood. We come back with a proposal. No payment here.",
      },
      order_occasion: { fr: "Le type d'événement", nl: "Soort evenement", en: "Type of event" },
      order_card: { fr: "Votre demande", nl: "Uw aanvraag", en: "Your request" },
      order_card_help: {
        fr: "Nombre de convives, lieu, allergies.",
        nl: "Aantal gasten, locatie, allergieën.",
        en: "Number of guests, venue, allergies.",
      },
      subscription_title: {
        fr: "Chaque semaine au bureau",
        nl: "Elke week op kantoor",
        en: "Every week at the office",
      },
      subscription_intro: {
        fr: "Des livraisons régulières pour vos équipes.",
        nl: "Regelmatige leveringen voor uw teams.",
        en: "Regular deliveries for your teams.",
      },
    },
  },

  /*
   * Boucherie, charcuterie, poissonnerie. Le chiffre exceptionnel tient aux
   * fêtes : c'est la commande de fin d'année, de Pâques ou du barbecue qui
   * justifie le formulaire, pas le steak du mardi.
   */
  boucherie: {
    id: "boucherie",
    nom: "Boucherie, poissonnerie",
    types: ["butcher", "fishmonger"],
    commande: "commande",
    sections: ["occasions", "prestations", "livraison", "equipe"],
    styles: ["marche", "atelier", "fournil", "comptoir"],
    motifs: ["couvert", "rayures", "silhouette"],
    vocabulaire: {
      services_title: { fr: "Nos spécialités", nl: "Onze specialiteiten", en: "Our specialities" },
      gallery_title: { fr: "L'étal", nl: "De toonbank", en: "The counter" },
      team_title: { fr: "Derrière le comptoir", nl: "Achter de toonbank", en: "Behind the counter" },
      cta_title: {
        fr: "Une commande pour les fêtes ?",
        nl: "Een bestelling voor de feestdagen?",
        en: "An order for the holidays?",
      },
      book: { fr: "Commander", nl: "Bestellen", en: "Order" },
      book_short: { fr: "Commander", nl: "Bestellen", en: "Order" },
      order_title: { fr: "Passer commande", nl: "Een bestelling plaatsen", en: "Place an order" },
      order_intro: {
        fr: "Dites-nous ce qu'il vous faut et pour quand. Nous vous rappelons pour confirmer. Aucun paiement ici.",
        nl: "Vertel ons wat u nodig hebt en voor wanneer. Wij bellen u terug om te bevestigen. Geen betaling hier.",
        en: "Tell us what you need and for when. We call you back to confirm. No payment here.",
      },
      order_card: { fr: "Votre commande", nl: "Uw bestelling", en: "Your order" },
      order_card_help: {
        fr: "Pièces, poids, cuisson.",
        nl: "Stukken, gewicht, bereiding.",
        en: "Cuts, weight, preparation.",
      },
    },
  },

  /*
   * Caviste, épicerie fine. La box mensuelle est le seul revenu récurrent du
   * métier, et presque aucun caviste ne la présente en ligne : l'abonnement
   * est ici l'argument de vente du site, pas une section de plus.
   */
  caviste: {
    id: "caviste",
    nom: "Caviste, épicerie fine",
    types: ["wine_store", "deli"],
    commande: "commande",
    sections: ["occasions", "prestations", "abonnement", "livraison", "equipe"],
    styles: ["naturemorte", "herbier", "comptoir", "ganache"],
    motifs: ["bouteille", "carre", "rayures"],
    vocabulaire: {
      services_title: { fr: "Notre sélection", nl: "Onze selectie", en: "Our selection" },
      gallery_title: { fr: "La cave", nl: "De kelder", en: "The cellar" },
      team_title: { fr: "Qui vous conseille", nl: "Wie u adviseert", en: "Who advises you" },
      cta_title: {
        fr: "Un conseil, une commande ?",
        nl: "Advies of een bestelling?",
        en: "Advice, or an order?",
      },
      book: { fr: "Commander", nl: "Bestellen", en: "Order" },
      book_short: { fr: "Commander", nl: "Bestellen", en: "Order" },
      order_title: { fr: "Commander", nl: "Bestellen", en: "Order" },
      order_card: { fr: "Votre demande", nl: "Uw aanvraag", en: "Your request" },
      order_card_help: {
        fr: "Occasion, goûts, budget par bouteille.",
        nl: "Gelegenheid, smaak, budget per fles.",
        en: "Occasion, taste, budget per bottle.",
      },
      subscription_title: { fr: "La box du mois", nl: "De box van de maand", en: "The monthly box" },
      subscription_intro: {
        fr: "Une sélection livrée chaque mois, choisie pour vous.",
        nl: "Elke maand een selectie, voor u gekozen.",
        en: "A selection delivered every month, chosen for you.",
      },
    },
  },

  /*
   * Restaurant. Le plus gros gisement de Bruxelles, et le seul métier qui
   * demandait deux choses neuves : une carte, et une demande de table.
   *
   * La carte passe avant tout le reste — c'est ce que le client vient
   * chercher, avant même les photos. Les occasions y servent aux groupes et à
   * la privatisation, qui sont les demandes que le téléphone gère mal.
   */
  restaurant: {
    id: "restaurant",
    nom: "Restaurant",
    types: ["restaurant"],
    commande: "table",
    sections: ["carte", "occasions", "livraison", "equipe"],
    styles: ["comptoir", "terrazzo", "signature", "naturemorte", "nuit"],
    motifs: ["couvert", "bouteille", "rayures"],
    vocabulaire: {
      services_title: { fr: "Nos formules", nl: "Onze formules", en: "Our set menus" },
      gallery_title: { fr: "La salle", nl: "De zaal", en: "The dining room" },
      team_title: { fr: "En cuisine", nl: "In de keuken", en: "In the kitchen" },
      occasions_title: {
        fr: "Groupes & privatisation",
        nl: "Groepen & privatisering",
        en: "Groups & private hire",
      },
      cta_title: {
        fr: "Envie de passer à table ?",
        nl: "Zin om aan tafel te gaan?",
        en: "Care to join us?",
      },
      book: { fr: "Réserver une table", nl: "Een tafel reserveren", en: "Book a table" },
      book_short: { fr: "Réserver", nl: "Reserveren", en: "Book" },
    },
  },

  /*
   * Café, bar, salon de thé.
   *
   * Le plus gros volume après les restaurants, et le plus facile à démarcher :
   * on entre, on commande un café, on montre le site sur son téléphone. La
   * carte leur suffit — la même que les restaurants, en plus court — et
   * personne n'y réserve de table.
   *
   * C'est aussi le métier où l'apparence décide seule : un café se choisit sur
   * une photo, et le style « Terrazzo » existe pour ça.
   */
  cafe: {
    id: "cafe",
    nom: "Café, bar, salon de thé",
    types: ["cafe", "bar", "tea_room"],
    commande: "aucun",
    sections: ["carte", "equipe"],
    styles: ["terrazzo", "comptoir", "maison", "fournil", "nuit"],
    motifs: ["tasse", "carre", "rayures"],
    vocabulaire: {
      gallery_title: { fr: "Le lieu", nl: "De zaak", en: "The place" },
      team_title: { fr: "Derrière le comptoir", nl: "Achter de toog", en: "Behind the counter" },
      cta_title: {
        fr: "On vous garde une place ?",
        nl: "Houden we een plaatsje vrij?",
        en: "Shall we save you a seat?",
      },
    },
  },

  /*
   * Salle de sport, yoga, pilates.
   *
   * Un cours n'est pas un rendez-vous : il a un horaire fixe, une capacité, et
   * plusieurs inscrits sur le même créneau. Le planning affiché répond à la
   * seule question qu'on se pose avant de pousser la porte — « qu'est-ce qu'il
   * y a le mardi soir ? ». L'inscription en ligne viendra si elle se vend ;
   * sans elle, le site reste utile, ce qui n'est pas le cas d'un agenda faux.
   */
  sport: {
    id: "sport",
    nom: "Salle de sport, yoga",
    types: ["gym", "yoga_studio"],
    commande: "aucun",
    sections: ["planning", "prestations", "equipe"],
    styles: ["studio", "nuit", "signature", "terrazzo"],
    motifs: ["haltere", "silhouette", "rayures"],
    vocabulaire: {
      services_title: { fr: "Nos formules", nl: "Onze formules", en: "Our memberships" },
      gallery_title: { fr: "La salle", nl: "De zaal", en: "The studio" },
      team_title: { fr: "Les coachs", nl: "De coaches", en: "The coaches" },
      cta_title: { fr: "Envie d'essayer ?", nl: "Zin om te proberen?", en: "Want to try?" },
    },
  },

  /*
   * Tout le reste. Vitrine seule — mieux vaut un site honnête qu'un
   * formulaire de commande qui promet ce que le commerce ne sait pas tenir.
   * C'est aussi le repli de tout type inconnu : un site en vitrine vaut mieux
   * qu'une construction qui échoue.
   */
  commerce: {
    id: "commerce",
    nom: "Autre commerce",
    types: ["other"],
    commande: "aucun",
    sections: ["prestations", "equipe"],
    styles: ["maison", "atelier", "studio", "signature", "nuit"],
    motifs: ["rayures", "silhouette"],
    vocabulaire: {},
  },
};

/** Le métier d'un commerce, déduit de son type. */
export function metierDe(type: string): Metier {
  for (const metier of Object.values(METIERS)) {
    if (metier.types.includes(type)) return metier;
  }
  // Un type inconnu n'a pas à faire échouer une construction : il vaut mieux
  // un site en vitrine qu'un site absent.
  return METIERS.commerce!;
}

/** Un métier affiche-t-il cette section ? */
export function afficheSection(type: string, section: SectionMetier): boolean {
  return metierDe(type).sections.includes(section);
}

/**
 * Ce métier reçoit-il des demandes dans la table `orders` ?
 *
 * La commande et la demande de table partagent tout : une intention datée que
 * le commerce rappelle pour confirmer, la même table, la même page « Mes
 * commandes ». Seuls deux champs les séparent. Cette fonction existe pour que
 * l'ajout d'un troisième mode de ce genre ne demande pas de retrouver les
 * quatre endroits qui comparaient à `"commande"`.
 */
export function prendCommandes(type: string): boolean {
  const mode = metierDe(type).commande;
  return mode === "commande" || mode === "table";
}

/** Le style proposé par défaut à un métier : le premier de sa liste. */
export function styleParDefaut(metierId: string): string {
  return METIERS[metierId]?.styles[0] ?? "maison";
}
