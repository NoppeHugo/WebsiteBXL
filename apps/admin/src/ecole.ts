/**
 * Les règles de l'espace de cours, sans base de données.
 *
 * Tout ce qui décide — un exercice est-il fait, un devoir est-il en retard,
 * une invitation est-elle encore ouverte, un lien est-il présentable à un
 * élève — vit ici, en fonctions pures. Les requêtes sont dans `db-ecole.ts`.
 *
 * Le partage n'est pas cosmétique : ces réponses sont données à deux endroits
 * — la page du responsable et celle de l'élève — et deux calculs séparés
 * finiraient par ne plus dire la même chose. Un élève verrait « rendu » là où
 * son professeur lit « en retard », et c'est le professeur qu'on appellerait.
 */

export interface Ecole {
  id: string;
  nom: string;
  created_at: Date;
}

export interface Eleve {
  id: string;
  ecole_id: string;
  email: string;
  prenom: string;
  nom: string;
  password_hash: string | null;
  invitation: string | null;
  invitation_fin: Date | null;
  actif_le: Date | null;
  last_login_at: Date | null;
  created_at: Date;
}

export interface Exercice {
  id: string;
  titre: string;
  consigne: string;
  lien: string | null;
  matiere: string | null;
  ordre: number;
  publie: boolean;
  updated_at: Date;
}

export interface Travail {
  exercice_id: string;
  reponse: string;
  statut: "commence" | "rendu";
  rendu_le: Date | null;
  correction: string | null;
  appreciation: "acquis" | "a_revoir" | null;
  corrige_le: Date | null;
}

export interface Devoir {
  exercice_id: string;
  du_le: Date | null;
}

/* -------------------------------------------------------------------------- */
/* Où en est un exercice                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Cinq états, et un seul mot pour chacun.
 *
 * « à revoir » n'est pas un échec mais une étape : l'exercice a été rendu, il
 * est corrigé, et il attend une seconde version. Le distinguer d'« acquis »
 * est ce qui permet au responsable de retrouver, en une page, les six élèves
 * qui doivent reprendre quelque chose.
 */
export type EtatTravail = "a-faire" | "commence" | "rendu" | "acquis" | "a-revoir";

export const MOT_ETAT: Record<EtatTravail, string> = {
  "a-faire": "Pas commencé",
  commence: "Commencé",
  rendu: "Rendu, en attente de correction",
  acquis: "Acquis",
  "a-revoir": "À revoir",
};

export function etatDuTravail(travail?: Travail): EtatTravail {
  if (!travail) return "a-faire";
  if (travail.corrige_le && travail.appreciation) {
    return travail.appreciation === "acquis" ? "acquis" : "a-revoir";
  }
  return travail.statut === "rendu" ? "rendu" : "commence";
}

/**
 * L'exercice a-t-il été rendu au moins une fois ?
 *
 * C'est ce que compte la barre d'avancement. « À revoir » y compte comme fait :
 * l'élève a travaillé, et une barre qui recule après une correction découragerait
 * exactement celui qu'elle doit encourager.
 */
export function estRendu(etat: EtatTravail): boolean {
  return etat === "rendu" || etat === "acquis" || etat === "a-revoir";
}

export interface Avancement {
  rendus: number;
  total: number;
  /** Entier de 0 à 100, pour la largeur de la jauge. */
  pourcentage: number;
}

export function avancement(etats: EtatTravail[]): Avancement {
  const total = etats.length;
  const rendus = etats.filter(estRendu).length;
  return {
    rendus,
    total,
    // Une école sans exercice publié n'est pas à 100 % : elle n'a rien à
    // montrer. Zéro sur zéro vaut zéro, et la jauge reste vide.
    pourcentage: total === 0 ? 0 : Math.round((rendus / total) * 100),
  };
}

/**
 * Un devoir est en retard quand sa date est passée et qu'il n'a pas été rendu.
 *
 * Les deux conditions comptent : un devoir rendu la veille reste rendu le
 * lendemain, et un devoir sans date n'est jamais en retard — c'est justement
 * pourquoi la date est facultative.
 */
export function enRetard(
  du_le: Date | null,
  etat: EtatTravail,
  aujourdhui = new Date(),
): boolean {
  if (!du_le || estRendu(etat)) return false;
  return jour(du_le) < jour(aujourdhui);
}

/** La date seule, sans l'heure : un devoir dû aujourd'hui l'est jusqu'à minuit. */
function jour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Ce qui vient d'un formulaire                                               */
/* -------------------------------------------------------------------------- */

/**
 * Le lien d'un exercice, s'il est présentable.
 *
 * Le responsable colle ici l'adresse d'une vidéo ou d'un PDF, et cette adresse
 * devient un `href` sur la page de ses élèves. Un `javascript:` collé là — par
 * maladresse ou non — s'exécuterait dans leur navigateur, avec leur session.
 * Deux schémas suffisent à tout usage légitime ; le reste est refusé.
 */
export function lienPresentable(brut: string | undefined | null): string | undefined {
  const valeur = (brut ?? "").trim();
  if (valeur === "") return undefined;
  try {
    const url = new URL(valeur);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function nomComplet(eleve: { prenom: string; nom: string }): string {
  return `${eleve.prenom} ${eleve.nom}`.trim();
}

export function emailValide(brut: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(brut.trim());
}

/**
 * L'invitation est-elle encore utilisable ?
 *
 * Elle expire, parce qu'un lien qui ouvre un compte reste dangereux tant qu'il
 * vaut : une adresse mal tapée met l'invitation dans la boîte de quelqu'un
 * d'autre, et deux semaines suffisent à ce que l'élève attendu s'en aperçoive.
 * Une invitation déjà acceptée ne vaut plus rien non plus — sans quoi le lien
 * gardé dans un fil de messages rouvrirait le compte des mois plus tard.
 */
export function invitationOuverte(
  eleve: Pick<Eleve, "invitation" | "invitation_fin" | "actif_le">,
  maintenant = new Date(),
): boolean {
  if (!eleve.invitation || eleve.actif_le) return false;
  return eleve.invitation_fin !== null && eleve.invitation_fin.getTime() > maintenant.getTime();
}

export interface ChampsExercice {
  titre: string;
  consigne: string;
  matiere: string | null;
  lien: string | null;
}

/**
 * Valide un exercice tel qu'il sort du formulaire.
 *
 * Le titre est le seul champ obligatoire : c'est lui qui apparaît dans la
 * liste de l'élève, et un exercice sans titre y devient une ligne vide sur
 * laquelle on clique au hasard. Une consigne peut légitimement manquer — un
 * exercice qui n'est qu'un lien vers une vidéo se suffit.
 */
export function validerExercice(
  brut: Partial<Record<"titre" | "consigne" | "matiere" | "lien", string>>,
): { ok: true; valeur: ChampsExercice } | { ok: false; raison: string } {
  const titre = (brut.titre ?? "").trim();
  if (titre === "") return { ok: false, raison: "Un exercice a besoin d'un titre." };
  if (titre.length > 160) {
    return { ok: false, raison: "Le titre est trop long : 160 caractères au plus." };
  }

  const lienBrut = (brut.lien ?? "").trim();
  const lien = lienPresentable(lienBrut);
  if (lienBrut !== "" && !lien) {
    return {
      ok: false,
      raison: "Le lien doit commencer par http:// ou https://.",
    };
  }

  const matiere = (brut.matiere ?? "").trim();
  return {
    ok: true,
    valeur: {
      titre,
      consigne: (brut.consigne ?? "").trim(),
      matiere: matiere === "" ? null : matiere.slice(0, 60),
      lien: lien ?? null,
    },
  };
}

/**
 * Une date de remise venue du formulaire, ou rien.
 *
 * Rien est une réponse valable — « pour le prochain cours » n'a pas de date —
 * mais une date illisible n'en est pas une : elle deviendrait un devoir
 * éternellement en retard, ou jamais.
 */
export function dateDeRemise(brut: string | undefined): Date | null {
  const valeur = (brut ?? "").trim();
  if (valeur === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const date = new Date(`${valeur}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
