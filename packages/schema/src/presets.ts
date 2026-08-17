import type { ThemeConfig } from "./index.ts";

/**
 * Styles et palettes proposés au commerçant.
 *
 * Le `theme.json` de chaque client reste la source de vérité, et n'importe
 * lequel de ses réglages peut être modifié à la main. Ces ensembles ne sont
 * qu'un point de départ cohérent : deux axes indépendants — la forme et la
 * couleur — que l'on croise pour obtenir une identité, au lieu de refaire une
 * maquette à chaque signature.
 *
 * La séparation des deux axes est délibérée. Un style tient à la typographie,
 * aux proportions et à la disposition ; ce sont eux qui font qu'un site
 * ressemble à un barbier ou à un salon de coiffure. La couleur, elle, se
 * change en une seconde devant le client, et c'est la première chose qu'il
 * demande.
 */

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

/** Tout ce qui fait la forme, hors couleur. */
export type Style = Pick<ThemeConfig, "fonts" | "layout" | "radius" | "grain" | "effects">;

export interface StyleDefini {
  nom: string;
  /** Ce que le commerçant reconnaîtra : à qui ce style ressemble. */
  pour: string;
  style: Style;
}

const PILE_SYSTEME =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const STYLES: Record<string, StyleDefini> = {
  /*
   * Le texte quitte la photo et se pose sur le fond : l'image garde sa force,
   * la lecture ne dépend plus de ce qu'il y a sous les lettres. Les libellés en
   * petites capitales espacées font tout le raffinement — aucun effet, aucun
   * arrondi, aucune couleur d'accent.
   */
  maison: {
    nom: "Maison",
    pour: "Élégant et discret. Le blanc, des filets fins, rien qui dépasse.",
    style: {
      fonts: {
        display: `Inter, ${PILE_SYSTEME}`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 400,
        displayTracking: "-0.03em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.14em",
      },
      layout: { hero: "split", heroAlign: "start", gallery: "marquee", nav: "solid" },
      radius: "none",
      grain: false,
      effects: { glass: false, blur: 0, reveal: true, parallax: true },
    },
  },

  /*
   * Empattements carrés et grain : le vocabulaire des enseignes d'atelier,
   * peintes à la main entre 1890 et 1930, quand les barbiers étaient des
   * adresses de luxe. La photo occupe tout l'écran, comme une devanture.
   */
  atelier: {
    nom: "Atelier",
    pour: "Barbier traditionnel. Chaud, artisanal, un peu d'usure.",
    style: {
      fonts: {
        display: `Bitter, Georgia, 'Times New Roman', serif`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 600,
        displayTracking: "-0.01em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.16em",
      },
      layout: { hero: "fullbleed", heroAlign: "start", gallery: "grid", nav: "overlay" },
      radius: "none",
      grain: true,
      effects: { glass: false, blur: 0, reveal: true, parallax: true },
    },
  },

  /*
   * Une condensée en capitales, serrée et haute : c'est l'affiche collée sur
   * un mur, pas la carte de visite. La mosaïque casse la grille régulière —
   * le seul style où les photos ne s'alignent pas sagement.
   */
  studio: {
    nom: "Studio",
    pour: "Urbain et direct. Grandes capitales, contrastes marqués.",
    style: {
      fonts: {
        display: `Oswald, 'Arial Narrow', ${PILE_SYSTEME}`,
        body: `Archivo, ${PILE_SYSTEME}`,
        displayWeight: 600,
        displayTracking: "0.005em",
        displayTransform: "uppercase",
        uiTransform: "uppercase",
        uiTracking: "0.2em",
      },
      layout: { hero: "fullbleed", heroAlign: "start", gallery: "mosaic", nav: "overlay" },
      radius: "none",
      grain: false,
      effects: { glass: false, blur: 0, reveal: true, parallax: true },
    },
  },

  /*
   * Le style le plus dépouillé : un titre en graisse fine, très grand, et
   * beaucoup de vide autour. Il ne tient que si les photos sont bonnes — c'est
   * pourquoi il est réservé aux commerces qui ont fait une vraie séance.
   */
  signature: {
    nom: "Signature",
    pour: "Haut de gamme. Grande photo, titre posé dessus, très peu de texte.",
    style: {
      fonts: {
        display: `Archivo, ${PILE_SYSTEME}`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 300,
        displayTracking: "-0.04em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.18em",
      },
      layout: { hero: "overlap", heroAlign: "start", gallery: "strip", nav: "solid" },
      radius: "none",
      grain: false,
      effects: { glass: false, blur: 0, reveal: true, parallax: false },
    },
  },

  /*
   * Surfaces translucides, angles très arrondis, photo plein écran : le
   * vocabulaire des applications. À réserver aux salons qui se disent modernes
   * — sur une palette claire, le verre translucide ne donne rien.
   */
  nuit: {
    nom: "Nuit",
    pour: "Salon contemporain. Fond sombre, surfaces vitrées, arrondis.",
    style: {
      fonts: {
        display: `Inter, ${PILE_SYSTEME}`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 600,
        displayTracking: "-0.022em",
        displayTransform: "none",
        uiTransform: "none",
        uiTracking: "0",
      },
      layout: { hero: "fullbleed", heroAlign: "center", gallery: "marquee", nav: "overlay" },
      radius: "round",
      grain: false,
      effects: { glass: true, blur: 22, reveal: true, parallax: true },
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Palettes                                                                   */
/* -------------------------------------------------------------------------- */

export interface PaletteDefinie {
  nom: string;
  /** Vrai si le fond est sombre : la console adapte son aperçu. */
  sombre: boolean;
  palette: ThemeConfig["palette"];
}

/**
 * Chaque palette est vérifiée : le texte courant tient au moins 4,5:1 sur le
 * fond, et le texte secondaire aussi. Un contraste insuffisant ne se voit pas
 * sur l'écran du concepteur — il se voit sur un téléphone, au soleil, par le
 * client du salon.
 */
export const PALETTES: Record<string, PaletteDefinie> = {
  blanc: {
    nom: "Blanc",
    sombre: false,
    palette: {
      bg: "#ffffff",
      surface: "#f4f4f2",
      text: "#15120f",
      muted: "#6e6862",
      accent: "#15120f",
      accentText: "#ffffff",
      border: "#e3e0dc",
    },
  },

  nuit: {
    nom: "Nuit",
    sombre: true,
    palette: {
      bg: "#000000",
      surface: "#1d1d1f",
      text: "#f5f5f7",
      muted: "#9a9a9f",
      accent: "#f5f5f7",
      accentText: "#000000",
      border: "#2c2c2e",
    },
  },

  sable: {
    nom: "Sable",
    sombre: false,
    palette: {
      bg: "#f7f4ee",
      surface: "#efe9df",
      text: "#231d16",
      muted: "#6b6055",
      accent: "#231d16",
      accentText: "#f7f4ee",
      border: "#ded5c8",
    },
  },

  encre: {
    nom: "Encre",
    sombre: true,
    palette: {
      bg: "#0f1720",
      surface: "#18222d",
      text: "#eef2f6",
      muted: "#9aa8b6",
      accent: "#eef2f6",
      accentText: "#0f1720",
      border: "#243040",
    },
  },

  /* La seule palette où l'accent porte une couleur : le cuivre du fût de
     barbier. Réservé au bouton principal, jamais au texte courant, dont il ne
     tiendrait pas le contraste en petit corps. */
  cuivre: {
    nom: "Cuivre",
    sombre: false,
    palette: {
      bg: "#ffffff",
      surface: "#f6f2ee",
      text: "#1b1512",
      muted: "#6d6058",
      accent: "#8a4f27",
      accentText: "#ffffff",
      border: "#e6ddd4",
    },
  },

  sauge: {
    nom: "Sauge",
    sombre: false,
    palette: {
      bg: "#f6f7f4",
      surface: "#eaeee6",
      text: "#1a1f18",
      muted: "#5f6b5c",
      accent: "#2f4231",
      accentText: "#f6f7f4",
      border: "#d8e0d3",
    },
  },
};

/** Assemble un thème complet à partir d'un style et d'une palette. */
export function composerTheme(styleId: string, paletteId: string): ThemeConfig {
  const style = STYLES[styleId];
  const palette = PALETTES[paletteId];
  if (!style) throw new Error(`style inconnu : ${styleId}`);
  if (!palette) throw new Error(`palette inconnue : ${paletteId}`);

  /*
   * Copie profonde, et non les objets eux-mêmes.
   *
   * Sans elle, le thème rendu partage ses sous-objets avec les définitions
   * ci-dessus : retoucher la couleur d'accent d'un client repeindrait la
   * palette pour tous les autres traités par le même processus, et la
   * reconnaissance continuerait de dire que le thème est intact. Trouvé par le
   * test qui vérifie qu'un thème retouché n'est plus reconnu.
   */
  return structuredClone({
    preset: { style: styleId, palette: paletteId },
    palette: palette.palette,
    ...style.style,
  }) as ThemeConfig;
}

/* -------------------------------------------------------------------------- */
/* Reconnaissance                                                             */
/* -------------------------------------------------------------------------- */

/** Comparaison stable : l'ordre des clés d'un objet ne doit rien décider. */
function memeContenu(a: unknown, b: unknown): boolean {
  const trier = (valeur: unknown): unknown => {
    if (Array.isArray(valeur)) return valeur.map(trier);
    if (valeur && typeof valeur === "object") {
      return Object.fromEntries(
        Object.entries(valeur as Record<string, unknown>)
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([cle, v]) => [cle, trier(v)]),
      );
    }
    return valeur;
  };
  return JSON.stringify(trier(a)) === JSON.stringify(trier(b));
}

/**
 * Retrouve le style et la palette d'un thème.
 *
 * Le champ `preset` répond directement quand il est là. Il manque à tous les
 * thèmes écrits avant son introduction, et à ceux réglés à la main : la console
 * ne pouvait alors marquer aucune sélection, et la page d'apparence s'ouvrait
 * comme si rien n'était appliqué. La comparaison des valeurs rattrape ces cas.
 *
 * Un thème retouché après coup ne correspond plus exactement, et c'est bien
 * ainsi : il n'est plus l'un de ces ensembles, et le dire serait faux.
 */
export function reconnaitrePreset(theme: ThemeConfig): {
  style?: string;
  palette?: string;
} {
  if (theme.preset) return theme.preset;

  const style = Object.entries(STYLES).find(([, definie]) =>
    memeContenu(definie.style, {
      fonts: theme.fonts,
      layout: theme.layout,
      radius: theme.radius,
      grain: theme.grain,
      effects: theme.effects,
    }),
  )?.[0];

  const palette = Object.entries(PALETTES).find(([, definie]) =>
    memeContenu(definie.palette, theme.palette),
  )?.[0];

  return { style, palette };
}
