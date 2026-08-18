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
   * Fleuriste.
   *
   * Trois renversements par rapport au précédent, et ce sont eux qui
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
   * Tout le reste, pour l'instant : boulangerie, et les commerces qu'on ne
   * sait pas encore nommer. Vitrine seule — mieux vaut un site honnête qu'un
   * formulaire de commande qui promet ce que le commerce ne sait pas tenir.
   */
  commerce: {
    id: "commerce",
    nom: "Autre commerce",
    types: ["bakery", "other"],
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

/** Le style proposé par défaut à un métier : le premier de sa liste. */
export function styleParDefaut(metierId: string): string {
  return METIERS[metierId]?.styles[0] ?? "maison";
}
