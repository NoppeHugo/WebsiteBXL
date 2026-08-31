import { escape } from "./views.ts";
import { layoutClient, dateLisible } from "./views-client.ts";
import { MOT_ETAT, type Avancement, type EtatTravail } from "./ecole.ts";

/**
 * L'habillage de l'espace de cours.
 *
 * Il emprunte la mise en page de l'espace commerçant — une colonne, des cibles
 * larges, aucune abréviation — parce que ses lecteurs sont les mêmes : des gens
 * debout, sur un téléphone, entre deux choses. Un professeur d'auto-école lit
 * ses corrections dans sa voiture ; un élève ouvre son exercice dans le tram.
 *
 * Ce qui change, c'est le vocabulaire et l'ordre des priorités, pas la matière.
 * Réécrire une seconde feuille de style aurait produit deux interfaces qui
 * dérivent, et deux endroits à corriger le jour où un bouton est trop petit.
 */

export function layoutEcole(
  titre: string,
  corps: string,
  options: { nom?: string; retour?: string } = {},
): string {
  return layoutClient(titre, corps, {
    nomCommerce: options.nom,
    retour: options.retour,
  });
}

/** L'état d'un exercice, en un mot. */
export function etiquette(etat: EtatTravail): string {
  return `<span class="etiquette" data-etat="${etat}">${escape(MOT_ETAT[etat])}</span>`;
}

export function etiquetteRetard(du_le: Date | null, retard: boolean): string {
  if (!du_le) return `<span class="etiquette">Sans date</span>`;
  return `<span class="etiquette" data-retard="${retard ? "oui" : "non"}">${
    retard ? "En retard depuis le " : "Pour le "
  }${escape(dateLisible(du_le))}</span>`;
}

/**
 * La barre d'avancement, avec son compte écrit à côté.
 *
 * Le texte n'est pas décoratif : une barre seule n'est pas lisible par un
 * lecteur d'écran, et « 7 sur 12 » est de toute façon ce qu'on recopie quand
 * on appelle un parent.
 */
export function jauge(a: Avancement): string {
  return `<div class="jauge" role="img"
     aria-label="${a.rendus} exercice${a.rendus > 1 ? "s" : ""} rendu${a.rendus > 1 ? "s" : ""} sur ${a.total}">
  <span class="jauge__part" style="width:${a.pourcentage}%"></span>
</div>
<span class="fiche__detail">${a.rendus} exercice${a.rendus > 1 ? "s" : ""} rendu${
    a.rendus > 1 ? "s" : ""
  } sur ${a.total}</span>`;
}

/**
 * Une carte cliquable de la liste d'accueil.
 *
 * Reprend `.menu` de l'espace commerçant : un pictogramme, un titre, une
 * phrase, et un compte facultatif à droite.
 */
export function carte(options: {
  href: string;
  icone: string;
  titre: string;
  sous: string;
  compte?: number;
}): string {
  return `<a href="${escape(options.href)}">
  <span class="menu__icone" aria-hidden="true">${options.icone}</span>
  <span class="menu__texte">
    <b>${escape(options.titre)}</b>
    <span>${escape(options.sous)}</span>
  </span>
  ${options.compte ? `<span class="menu__compte">${options.compte}</span>` : ""}
</a>`;
}

/** Le texte tapé par quelqu'un, rendu tel qu'il l'a écrit. */
export function copie(texte: string, de: "eleve" | "professeur" = "eleve"): string {
  return `<p class="copie" data-de="${de}">${escape(texte)}</p>`;
}

/**
 * « il y a trois jours », pour une date qui peut manquer.
 *
 * L'heure exacte d'un travail rendu n'apprend rien ; ce qui compte est de
 * savoir si l'élève a travaillé cette semaine ou il y a un mois.
 */
export function depuisLisible(date: Date | null): string {
  if (!date) return "jamais";
  const jours = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 31) return `il y a ${jours} jours`;
  return `le ${dateLisible(date)}`;
}
