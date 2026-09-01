/**
 * Ce qui donne envie de revenir : points, niveau, série, hauts faits.
 *
 * ─── Ce que ce module refuse de récompenser ───────────────────────────────
 *
 * Rien qui ne soit du travail. Pas de points pour s'être connecté, pas de
 * points pour avoir ouvert un exercice, pas de série pour être passé sans rien
 * faire. Un jeu qui récompense la présence apprend à venir sans travailler, et
 * le professeur se retrouve avec vingt élèves au niveau maximum qui ne savent
 * toujours pas se garer.
 *
 * Trois gestes comptent, et ce sont les trois qu'un professeur citerait :
 * rendre un exercice, l'avoir juste, et l'avoir rendu à temps.
 *
 * ─── Pourquoi tout est calculé, et rien n'est stocké ──────────────────────
 *
 * Les points sont une lecture des travaux, pas une colonne. Changer le barème
 * ne demande donc aucune migration, et il n'existe aucun moyen que le total
 * affiché contredise la liste d'exercices juste en dessous. La seule exception
 * est la série, qui a besoin d'une mémoire des jours : voir la migration 012.
 */

export interface StatsEleve {
  /** Exercices publiés rendus au moins une fois. */
  rendus: number;
  /** Parmi eux, ceux que le professeur a marqués « acquis ». */
  acquis: number;
  /** Devoirs datés rendus au plus tard le jour dit. */
  aLHeure: number;
  /** Exercices publiés, tous élèves confondus : le dénominateur. */
  total: number;
  /** Les jours travaillés, en AAAA-MM-JJ. L'ordre n'a pas d'importance. */
  jours: string[];
}

/**
 * Le barème, en un seul endroit et en clair.
 *
 * Volontairement lisible par le professeur, qui le verra affiché : un barème
 * secret transforme chaque total en sujet de discussion, et c'est lui qui
 * reçoit la question.
 */
export const BAREME = {
  /** Rendre un exercice. Compté une fois, quel que soit le nombre de versions. */
  rendu: 10,
  /** L'avoir juste. */
  acquis: 5,
  /** Un devoir rendu avant sa date. */
  aLHeure: 5,
} as const;

export function points(s: Pick<StatsEleve, "rendus" | "acquis" | "aLHeure">): number {
  return s.rendus * BAREME.rendu + s.acquis * BAREME.acquis + s.aLHeure * BAREME.aLHeure;
}

/* -------------------------------------------------------------------------- */
/* Niveaux                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sept paliers, d'un vocabulaire qui vaut pour une auto-école comme pour un
 * conservatoire — on ne dit ni « niveau 3 », qui ne veut rien dire, ni
 * « padawan », qui ne veut rien dire à un adulte de cinquante ans qui repasse
 * son permis.
 *
 * L'écart entre paliers croît : les premiers arrivent vite, parce que c'est au
 * début qu'on abandonne ; les derniers demandent un catalogue entier et de la
 * régularité, parce qu'un titre donné trop tôt ne vaut plus rien.
 */
export const NIVEAUX = [
  { nom: "Premiers pas", seuil: 0 },
  { nom: "En route", seuil: 60 },
  { nom: "Régulier", seuil: 150 },
  { nom: "Solide", seuil: 300 },
  { nom: "Aguerri", seuil: 520 },
  { nom: "Chevronné", seuil: 820 },
  { nom: "Maître", seuil: 1200 },
] as const;

export interface Niveau {
  /** De 1 à NIVEAUX.length. */
  rang: number;
  nom: string;
  /** Le palier suivant, ou rien pour qui est au sommet. */
  suivant: { nom: string; seuil: number } | null;
  /** Où en est la barre entre ce palier-ci et le suivant, de 0 à 100. */
  pourcentage: number;
  /** Ce qu'il reste à gagner pour monter. Zéro au sommet. */
  restant: number;
}

export function niveauDe(pts: number): Niveau {
  let rang = 1;
  for (let i = 0; i < NIVEAUX.length; i += 1) {
    if (pts >= NIVEAUX[i]!.seuil) rang = i + 1;
  }
  const palier = NIVEAUX[rang - 1]!;
  const suivant = NIVEAUX[rang] ?? null;

  if (!suivant) {
    // Au sommet, la barre est pleine. La laisser à moitié parce qu'il n'y a
    // plus de palier au-dessus donnerait l'impression d'un travail inachevé.
    return { rang, nom: palier.nom, suivant: null, pourcentage: 100, restant: 0 };
  }

  const parcouru = pts - palier.seuil;
  const largeur = suivant.seuil - palier.seuil;
  return {
    rang,
    nom: palier.nom,
    suivant: { nom: suivant.nom, seuil: suivant.seuil },
    pourcentage: Math.max(0, Math.min(100, Math.round((parcouru / largeur) * 100))),
    restant: suivant.seuil - pts,
  };
}

/* -------------------------------------------------------------------------- */
/* Série                                                                      */
/* -------------------------------------------------------------------------- */

/** La veille, en arithmétique de dates sûre — midi UTC ignore les heures d'été. */
export function veille(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Le nombre de jours travaillés d'affilée.
 *
 * ─── Pourquoi la série survit à la journée en cours ───────────────────────
 *
 * Elle part d'aujourd'hui si l'élève a déjà travaillé, sinon d'hier. Une série
 * qui tomberait à zéro dès minuit obligerait à ouvrir l'application chaque
 * matin pour ne pas « perdre » — c'est le mécanisme qui rend les applications
 * de langues détestables, et il produit du passage, pas du travail. Ici, on a
 * la journée entière pour la tenir, et on ne la perd qu'après un jour
 * réellement manqué.
 */
export function serie(jours: readonly string[], aujourdhui: string): number {
  const faits = new Set(jours);

  let curseur = aujourdhui;
  if (!faits.has(curseur)) {
    curseur = veille(curseur);
    if (!faits.has(curseur)) return 0;
  }

  let compte = 0;
  while (faits.has(curseur)) {
    compte += 1;
    curseur = veille(curseur);
  }
  return compte;
}

export interface JourDeSemaine {
  jour: string;
  /** « L », « M », « M », « J », « V », « S », « D ». */
  initiale: string;
  actif: boolean;
  aujourdhui: boolean;
}

const INITIALES = ["D", "L", "M", "M", "J", "V", "S"] as const;

/** Les sept derniers jours, du plus ancien au plus récent, pour la frise. */
export function semaine(jours: readonly string[], aujourdhui: string): JourDeSemaine[] {
  const faits = new Set(jours);
  const suite: JourDeSemaine[] = [];

  let curseur = aujourdhui;
  for (let i = 0; i < 7; i += 1) {
    suite.unshift({
      jour: curseur,
      initiale: INITIALES[new Date(`${curseur}T12:00:00Z`).getUTCDay()]!,
      actif: faits.has(curseur),
      aujourdhui: curseur === aujourdhui,
    });
    curseur = veille(curseur);
  }
  return suite;
}

/* -------------------------------------------------------------------------- */
/* Hauts faits                                                                */
/* -------------------------------------------------------------------------- */

export interface HautFait {
  id: string;
  emoji: string;
  nom: string;
  /** Ce qu'il faut faire, dit à l'élève avant qu'il l'ait fait. */
  phrase: string;
  obtenu: boolean;
  /** Où il en est. Affiché tel quel sous un haut fait non obtenu. */
  fait: number;
  requis: number;
}

/**
 * Les huit hauts faits, obtenus ou non — jamais cachés.
 *
 * Un haut fait secret ne motive personne : il ne se découvre qu'une fois
 * décroché, c'est-à-dire quand il ne sert plus à rien. Ceux-ci s'affichent
 * tous, avec le compte de ce qui manque — « 3 sur 5 » est une invitation,
 * un cadenas n'en est pas une.
 *
 * Quatre récompensent la quantité, deux la justesse et la ponctualité, deux la
 * régularité. Aucun ne récompense la vitesse : rien ne doit inciter un élève à
 * bâcler pour un dessin.
 */
export function hautsFaits(s: StatsEleve, serieEnCours: number): HautFait[] {
  const fait = (
    id: string,
    emoji: string,
    nom: string,
    phrase: string,
    valeur: number,
    requis: number,
  ): HautFait => ({
    id,
    emoji,
    nom,
    phrase,
    // `requis` nul : l'école n'a encore rien publié, le haut fait n'est pas
    // atteignable. Le donner d'office serait le donner pour rien.
    obtenu: requis > 0 && valeur >= requis,
    fait: Math.min(valeur, Math.max(requis, 0)),
    requis,
  });

  return [
    fait("depart", "🌱", "Le premier pas", "Rendre un premier exercice.", s.rendus, 1),
    fait("cinq", "📗", "Cinq exercices", "En rendre cinq.", s.rendus, 5),
    fait("quinze", "📚", "Quinze exercices", "En rendre quinze.", s.rendus, 15),
    fait(
      "juste",
      "🎯",
      "Cinq fois juste",
      "Obtenir « acquis » sur cinq exercices.",
      s.acquis,
      5,
    ),
    fait(
      "ponctuel",
      "⏱️",
      "Toujours à l'heure",
      "Rendre cinq devoirs avant leur date.",
      s.aLHeure,
      5,
    ),
    fait("serie3", "🔥", "Trois jours de suite", "Travailler trois jours d'affilée.", serieEnCours, 3),
    fait("serie7", "⚡", "Une semaine entière", "Travailler sept jours d'affilée.", serieEnCours, 7),
    fait(
      "programme",
      "🏁",
      "Tout le programme",
      "Rendre tous les exercices publiés.",
      s.rendus,
      s.total,
    ),
  ];
}

/** Ce qui vient d'être décroché, pour le dire à l'élève au moment où il rend. */
export function nouveauxHautsFaits(avant: HautFait[], apres: HautFait[]): HautFait[] {
  const acquis = new Set(avant.filter((h) => h.obtenu).map((h) => h.id));
  return apres.filter((h) => h.obtenu && !acquis.has(h.id));
}
