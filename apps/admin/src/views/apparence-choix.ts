import { STYLES, PALETTES } from "@bxl/schema/presets";
import { METIERS } from "@bxl/schema/metiers";
import { escape } from "../views.ts";

/**
 * Sélecteurs de style et de couleur.
 *
 * Extraits de la page Apparence parce que la création d'un client les emploie
 * aussi : en clientèle, le premier écran montré au commerçant est celui où il
 * choisit lui-même la forme de son site. Deux copies auraient divergé dès le
 * premier style ajouté — l'une des deux listes aurait cessé de le proposer,
 * sans que rien ne le signale.
 */

/**
 * Vignette d'un style : un titre, un filet, un bouton.
 *
 * Rendue avec les vraies polices et les vraies couleurs, pas une capture : elle
 * suit donc automatiquement toute modification d'un style, et pèse le poids
 * d'un peu de balisage.
 */
export function vignette(styleId: string, paletteId: string): string {
  const style = STYLES[styleId]!.style;
  const palette = PALETTES[paletteId]!.palette;
  const rayon = { none: "0", soft: "10px", round: "18px" }[style.radius];

  return `<span class="vignette" style="
    background:${palette.bg};
    color:${palette.text};
    border-color:${palette.border};
  ">
    <span class="vignette__titre" style="
      font-family:${style.fonts.display};
      font-weight:${style.fonts.displayWeight};
      letter-spacing:${style.fonts.displayTracking};
      text-transform:${style.fonts.displayTransform};
    ">Aa</span>
    <span class="vignette__filet" style="background:${palette.border}"></span>
    <span class="vignette__btn" style="
      background:${palette.accent};
      color:${palette.accentText};
      border-radius:${rayon};
      font-family:${style.fonts.body};
      text-transform:${style.fonts.uiTransform};
      letter-spacing:${style.fonts.uiTracking};
    ">Réserver</span>
  </span>`;
}

/**
 * @param marquerLActif  Pose la mention « appliqué » sur la sélection en cours.
 *   Vraie sur la page Apparence, où elle répond à « qu'est-ce qui est en
 *   place ? » ; fausse à la création, où rien n'est encore appliqué et où le
 *   mot serait un mensonge.
 */
export function grilleStyles(
  styleActif: string,
  paletteActive: string,
  marquerLActif = true,
  /**
   * Restreindre la grille à un métier. Vide, tous les styles sont rendus mais
   * étiquetés : c'est le cas du formulaire de création, où le type de commerce
   * peut encore changer et où la grille se filtre alors dans le navigateur.
   */
  metierId?: string,
): string {
  const retenus = metierId
    ? Object.entries(STYLES).filter(([, s]) => s.metiers.includes(metierId))
    : Object.entries(STYLES);

  return retenus
    .map(
      ([id, s]) => `<label class="choix${id === styleActif ? " est-actif" : ""}"
    data-metiers="${escape(s.metiers.join(" "))}">
    <input type="radio" name="style" value="${escape(id)}"${
      id === styleActif ? " checked" : ""
    } required>
    ${vignette(id, paletteActive || "blanc")}
    <span class="choix__texte">
      <b>${escape(s.nom)}${
        marquerLActif && id === styleActif ? ` <span class="marque">appliqué</span>` : ""
      }</b>
      <span>${escape(s.pour)}</span>
    </span>
  </label>`,
    )
    .join("");
}

export function grillePalettes(paletteActive: string, marquerLActif = true): string {
  return Object.entries(PALETTES)
    .map(
      ([id, p]) => `<label class="teinte${id === paletteActive ? " est-actif" : ""}">
    <input type="radio" name="palette" value="${escape(id)}"${
      id === paletteActive ? " checked" : ""
    } required>
    <span class="teinte__pastilles">
      <span style="background:${p.palette.bg}"></span>
      <span style="background:${p.palette.surface}"></span>
      <span style="background:${p.palette.accent}"></span>
      <span style="background:${p.palette.text}"></span>
    </span>
    <b>${escape(p.nom)}${
      marquerLActif && id === paletteActive ? ` <span class="marque">appliquée</span>` : ""
    }</b>
  </label>`,
    )
    .join("");
}
