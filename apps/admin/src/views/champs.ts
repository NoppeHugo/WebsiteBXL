import { LANGUAGES, type Language } from "@bxl/schema";
import { escape } from "../views.ts";

/**
 * Briques de l'éditeur de contenu.
 *
 * Tout ce que la console proposait jusqu'ici passait par un éditeur JSON : le
 * moindre changement de titre demandait de retrouver sa clé dans deux cents
 * lignes, sans se tromper d'accolade. Ces champs-là couvrent les mêmes données,
 * mais nommées comme sur le site — « Titre d'accueil » plutôt que
 * `hero.headline`.
 *
 * Les noms de champs suivent la notation à plat déjà employée pour les horaires
 * et les prestations (`hours.monday`, `services.0.price`) : le formulaire reste
 * un POST ordinaire, sans JavaScript pour l'envoi.
 */

export const NOMS_LANGUES: Record<Language, string> = {
  fr: "Français",
  nl: "Nederlands",
  en: "English",
};

/**
 * Un texte traduit, une langue par onglet.
 *
 * Les trois langues sont toujours rendues, même vides : un champ simplifié qui
 * n'afficherait que le français écraserait le néerlandais et l'anglais au
 * premier enregistrement — du travail facturé, perdu sans un message.
 *
 * Les onglets sont des boutons radio et des règles CSS, sans JavaScript : la
 * console doit rester utilisable sur un téléphone au réseau capricieux.
 */
export function texteTraduit(
  prefixe: string,
  libelle: string,
  valeurs: Partial<Record<Language, string>> | undefined,
  options: { lignes?: number; aide?: string; defaut: Language } = { defaut: "fr" },
): string {
  const id = prefixe.replace(/[^a-z0-9]/gi, "-");
  const onglets = LANGUAGES.map((lang) => {
    const actif = lang === options.defaut;
    const rempli = (valeurs?.[lang] ?? "").trim().length > 0;
    return `<input type="radio" name="onglet-${id}" id="${id}-${lang}" class="onglet__radio"${
      actif ? " checked" : ""
    }>
    <label for="${id}-${lang}" class="onglet__nom" data-rempli="${rempli}">${
      NOMS_LANGUES[lang]
    }</label>`;
  }).join("");

  const zones = LANGUAGES.map((lang) => {
    const valeur = escape(valeurs?.[lang] ?? "");
    const champ =
      (options.lignes ?? 1) > 1
        ? `<textarea name="${escape(prefixe)}.${lang}" rows="${options.lignes}">${valeur}</textarea>`
        : `<input type="text" name="${escape(prefixe)}.${lang}" value="${valeur}">`;
    return `<div class="onglet__zone">${champ}</div>`;
  }).join("");

  return `<div class="champ">
  <span class="champ__libelle">${escape(libelle)}</span>
  <div class="onglets">${onglets}<div class="onglets__zones">${zones}</div></div>
  ${options.aide ? `<p class="aide">${escape(options.aide)}</p>` : ""}
</div>`;
}

/** Un champ texte simple, non traduit (un nom propre, un numéro). */
export function texte(
  nom: string,
  libelle: string,
  valeur: string | undefined,
  options: { type?: string; aide?: string; attributs?: string } = {},
): string {
  return `<label>${escape(libelle)}
  <input type="${options.type ?? "text"}" name="${escape(nom)}" value="${escape(
    valeur ?? "",
  )}" ${options.attributs ?? ""}>
  ${options.aide ? `<span class="aide">${escape(options.aide)}</span>` : ""}
</label>`;
}

/**
 * Emplacement de photo : aperçu, dépôt de fichier, et le nom retenu.
 *
 * Le fichier n'est pas envoyé par ce formulaire mais par l'éditeur, dès le
 * dépôt : le visiteur voit son image apparaître à l'endroit où il l'a lâchée,
 * et le champ caché retient le nom que le serveur a donné au fichier. Envoyer
 * l'image avec le reste du formulaire obligerait à tout resaisir en cas
 * d'erreur de validation ailleurs dans la page.
 */
export function emplacementPhoto(
  slug: string,
  nom: string,
  libelle: string,
  fichier: string | undefined,
): string {
  const source = fichier
    ? `/clients/${escape(slug)}/media/${escape(fichier)}`
    : "";
  return `<div class="photo" data-photo data-slug="${escape(slug)}">
  <span class="champ__libelle">${escape(libelle)}</span>
  <label class="photo__zone" data-zone>
    <input type="file" accept="image/*" data-fichier hidden>
    <img src="${source}" alt="" data-apercu${fichier ? "" : ' hidden'}>
    <span class="photo__invite"${fichier ? " hidden" : ""}>
      Déposez une image ici, ou cliquez pour choisir
    </span>
    <span class="photo__etat" data-etat hidden></span>
  </label>
  <input type="hidden" name="${escape(nom)}" value="${escape(fichier ?? "")}" data-valeur>
  <button type="button" class="secondary photo__retirer" data-retirer${
    fichier ? "" : " hidden"
  }>Retirer</button>
</div>`;
}

/**
 * En-tête d'un élément de liste : poignée de déplacement et suppression.
 *
 * La poignée se saisit à la souris, mais les deux flèches restent présentes :
 * un glisser-déposer seul est inatteignable au clavier, et impraticable sur un
 * écran tactile étroit.
 */
export function barreElement(index: number, titre: string): string {
  return `<div class="element__barre">
  <span class="element__poignee" data-poignee title="Glisser pour déplacer">⠿</span>
  <b class="element__titre">${escape(titre)}</b>
  <span class="element__ordre">
    <button type="button" class="secondary" data-monter title="Monter">↑</button>
    <button type="button" class="secondary" data-descendre title="Descendre">↓</button>
    <button type="button" class="danger" data-supprimer title="Retirer">✕</button>
  </span>
  <input type="hidden" name="ordre" value="${index}" data-ordre>
</div>`;
}
