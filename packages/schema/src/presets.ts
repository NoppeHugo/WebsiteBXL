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
  /**
   * Métiers auxquels ce style est proposé.
   *
   * Un style n'est pas une couleur qu'on pose sur n'importe quoi : « Atelier »
   * suppose des photos de gestes et de matière, « Nature morte » suppose des
   * fleurs sur fond sombre. Proposer les cinq styles de coiffure à un fleuriste
   * lui ferait choisir celui qui va le moins bien à ses photos, et il en
   * conclurait que le site est raté.
   */
  metiers: readonly string[];
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
    metiers: ["soins", "commerce", "ongles", "spa", "opticien", "animaux", "patisserie", "traiteur", "cafe", "epicerie", "boutique", "services", "ecole", "photo"],
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
    metiers: ["soins", "commerce", "animaux", "tatouage", "boucherie", "services"],
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
    metiers: ["soins", "commerce", "opticien", "tatouage", "animaux", "sport", "snack", "boutique", "services", "ecole", "photo"],
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
    metiers: ["soins", "commerce", "ongles", "spa", "opticien", "chocolatier", "traiteur", "restaurant", "sport", "boutique", "ecole", "photo"],
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
    metiers: ["soins", "commerce", "ongles", "opticien", "tatouage", "restaurant", "cafe", "sport", "boutique", "photo"],
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

  /* ---------------------------------------------------------- fleuristes -- */

  /*
   * La lumière d'une serre : beaucoup de blanc, des filets fins, une serif à
   * empattements fins pour le titre. Tout est clair parce que les fleurs, elles,
   * ne le sont pas — un fond neutre laisse la couleur du bouquet exister seule.
   * C'est le vocabulaire des fleuristes de quartier haut de gamme.
   */
  serre: {
    nom: "Serre",
    pour: "Clair et végétal. Beaucoup de blanc, la couleur vient des fleurs.",
    metiers: ["fleuriste", "spa"],
    style: {
      fonts: {
        display: `Bitter, Georgia, 'Times New Roman', serif`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 400,
        displayTracking: "-0.015em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.14em",
      },
      layout: { hero: "split", heroAlign: "start", gallery: "grid", nav: "solid" },
      radius: "soft",
      grain: false,
      effects: { glass: false, blur: 0, reveal: true, parallax: true },
    },
  },

  /*
   * La nature morte flamande : fond sombre, fleurs éclairées d'un seul côté.
   * C'est une tradition picturale née à cent kilomètres d'ici, entre Anvers et
   * Bruxelles, et aucun autre commerce ne peut s'en réclamer aussi
   * légitimement qu'un fleuriste belge.
   *
   * Exige de bonnes photos, et les met en valeur comme aucun fond clair ne le
   * fait — d'où la photo plein écran et le grain, qui rappelle la toile.
   */
  naturemorte: {
    nom: "Nature morte",
    pour: "Fond sombre, fleurs éclairées. Somptueux, très belge. Demande de belles photos.",
    metiers: ["fleuriste", "chocolatier", "caviste", "restaurant"],
    style: {
      fonts: {
        display: `Bitter, Georgia, 'Times New Roman', serif`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 500,
        displayTracking: "-0.02em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.18em",
      },
      layout: { hero: "fullbleed", heroAlign: "start", gallery: "mosaic", nav: "overlay" },
      radius: "none",
      grain: true,
      effects: { glass: false, blur: 0, reveal: true, parallax: true },
    },
  },

  /*
   * Le marché : condensée en capitales, généreux, rapide à lire. Pour les
   * fleuristes de volume — un étal, des seaux, des prix affichés. La galerie
   * défile comme on passe devant les bacs.
   */
  marche: {
    nom: "Marché",
    pour: "Chaleureux et direct. Grandes capitales, prix assumés.",
    metiers: ["fleuriste", "patisserie", "boucherie", "snack", "epicerie"],
    style: {
      fonts: {
        display: `Oswald, 'Arial Narrow', ${PILE_SYSTEME}`,
        body: `Archivo, ${PILE_SYSTEME}`,
        displayWeight: 500,
        displayTracking: "0.01em",
        displayTransform: "uppercase",
        uiTransform: "uppercase",
        uiTracking: "0.16em",
      },
      layout: { hero: "fullbleed", heroAlign: "center", gallery: "marquee", nav: "solid" },
      radius: "soft",
      grain: false,
      effects: { glass: false, blur: 0, reveal: true, parallax: false },
    },
  },

  /*
   * La planche d'herbier : fond papier, titre en petites capitales espacées,
   * bande de photos alignée comme des spécimens. Le style le plus savant des
   * quatre — il suppose un fleuriste qui parle de ses variétés, pas seulement
   * de ses bouquets.
   */
  herbier: {
    nom: "Herbier",
    pour: "Raffiné et botanique. Papier, petites capitales, presque un livre.",
    metiers: ["fleuriste", "chocolatier", "traiteur", "caviste", "epicerie"],
    style: {
      fonts: {
        display: `Archivo, ${PILE_SYSTEME}`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 300,
        displayTracking: "-0.035em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.22em",
      },
      layout: { hero: "overlap", heroAlign: "start", gallery: "strip", nav: "solid" },
      radius: "none",
      grain: false,
      effects: { glass: false, blur: 0, reveal: true, parallax: false },
    },
  },

  /* -------------------------------------------------- métiers de bouche -- */

  /*
   * Le café moderne, celui qu'on photographie : angles très arrondis, grande
   * mosaïque de carrés, beaucoup d'air, une sans-serif neutre. C'est le style
   * qui se vend tout seul dans les cafés de spécialité — le commerçant y
   * reconnaît les comptes Instagram qu'il suit, et il n'a rien à décrire pour
   * qu'on comprenne ce qu'il veut.
   *
   * Il n'a de sens qu'avec de vraies photos carrées, ce qui tombe bien : un
   * café en a déjà des centaines sur son téléphone.
   */
  terrazzo: {
    nom: "Terrazzo",
    pour: "Café moderne, très photogénique. Arrondis généreux, mosaïque de carrés, beaucoup d'air.",
    metiers: ["cafe", "restaurant", "patisserie", "sport", "snack", "ecole"],
    style: {
      fonts: {
        display: `Archivo, ${PILE_SYSTEME}`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 500,
        displayTracking: "-0.025em",
        displayTransform: "none",
        uiTransform: "none",
        uiTracking: "0.02em",
      },
      layout: { hero: "split", heroAlign: "center", gallery: "mosaic", nav: "solid" },
      radius: "round",
      grain: false,
      effects: { glass: false, blur: 0, reveal: true, parallax: true },
    },
  },

  /*
   * Le fournil : une serif à empattements carrés, du grain, une grille sage.
   * Le vocabulaire du papier kraft et de la farine — chaud sans être rustique.
   * Contrairement à « Atelier », la photo ne prend pas tout l'écran : une
   * boulangerie se juge sur ses produits, pas sur sa devanture.
   */
  fournil: {
    nom: "Fournil",
    pour: "Boulangerie, pâtisserie. Chaud et artisanal, la vitrine avant le décor.",
    metiers: ["patisserie", "traiteur", "boucherie", "cafe", "epicerie"],
    style: {
      fonts: {
        display: `Bitter, Georgia, 'Times New Roman', serif`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 500,
        displayTracking: "-0.005em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.12em",
      },
      layout: { hero: "split", heroAlign: "start", gallery: "grid", nav: "solid" },
      radius: "soft",
      grain: true,
      effects: { glass: false, blur: 0, reveal: true, parallax: false },
    },
  },

  /*
   * Ganache : fond profond, cadrages serrés, une bande de photos qui défile
   * lentement. Le chocolat se photographie de près et sur fond sombre — c'est
   * la seule façon de faire lire le brillant d'une couverture bien tempérée.
   */
  ganache: {
    nom: "Ganache",
    pour: "Chocolatier. Fond profond, cadrages serrés, matière brillante.",
    metiers: ["chocolatier", "caviste"],
    style: {
      fonts: {
        display: `Bitter, Georgia, 'Times New Roman', serif`,
        body: `Archivo, ${PILE_SYSTEME}`,
        displayWeight: 400,
        displayTracking: "-0.02em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.2em",
      },
      layout: { hero: "overlap", heroAlign: "start", gallery: "mosaic", nav: "overlay" },
      radius: "soft",
      grain: false,
      effects: { glass: false, blur: 0, reveal: true, parallax: true },
    },
  },

  /*
   * Le comptoir : capitales espacées, photo pleine largeur, grain. L'ardoise
   * d'une brasserie, pas la carte d'un étoilé. Fait pour les lieux qui ont
   * plus de caractère que de moyens photographiques — le grain pardonne
   * beaucoup à une photo prise au téléphone un soir de service.
   */
  comptoir: {
    nom: "Comptoir",
    pour: "Bistrot, brasserie, bar. Ardoise, capitales, atmosphère du soir.",
    metiers: ["restaurant", "cafe", "boucherie", "caviste", "snack"],
    style: {
      fonts: {
        display: `Bitter, Georgia, 'Times New Roman', serif`,
        body: `Archivo, ${PILE_SYSTEME}`,
        displayWeight: 600,
        displayTracking: "-0.015em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.16em",
      },
      layout: { hero: "fullbleed", heroAlign: "center", gallery: "strip", nav: "overlay" },
      radius: "none",
      grain: true,
      effects: { glass: false, blur: 0, reveal: true, parallax: true },
    },
  },

  /* ------------------------------------------------- soins et corps -- */

  /*
   * Pétale : tout est arrondi, clair et espacé, et le titre est très fin. Les
   * photos d'onglerie et de spa sont serrées, douces et peu contrastées — un
   * style anguleux les fait paraître ratées, alors que le même cliché dans un
   * cadre arrondi passe pour délicat.
   */
  petale: {
    nom: "Pétale",
    pour: "Onglerie, spa. Doux, clair, arrondi — la peau et la lumière.",
    metiers: ["ongles", "spa", "animaux"],
    style: {
      fonts: {
        display: `Archivo, ${PILE_SYSTEME}`,
        body: `Inter, ${PILE_SYSTEME}`,
        displayWeight: 300,
        displayTracking: "-0.03em",
        displayTransform: "none",
        uiTransform: "uppercase",
        uiTracking: "0.16em",
      },
      layout: { hero: "split", heroAlign: "center", gallery: "strip", nav: "solid" },
      radius: "round",
      grain: false,
      effects: { glass: false, blur: 0, reveal: true, parallax: false },
    },
  },

  /*
   * Flash : le nom des planches de dessins punaisées au mur d'un salon de
   * tatouage. Capitales à empattements, grille régulière, grain de papier.
   * Le titre déborde sur la photo comme un tampon.
   */
  flash: {
    nom: "Flash",
    pour: "Tatouage, piercing. Planches au mur, capitales, trait dur.",
    metiers: ["tatouage"],
    style: {
      fonts: {
        display: `Bitter, Georgia, 'Times New Roman', serif`,
        body: `Archivo, ${PILE_SYSTEME}`,
        displayWeight: 600,
        displayTracking: "0.02em",
        displayTransform: "uppercase",
        uiTransform: "uppercase",
        uiTracking: "0.2em",
      },
      layout: { hero: "overlap", heroAlign: "start", gallery: "grid", nav: "overlay" },
      radius: "none",
      grain: true,
      effects: { glass: false, blur: 0, reveal: true, parallax: false },
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
  /* --- Pensées pour des fleurs, mais ouvertes à tous les métiers. --------- */

  /*
   * Le vert de serre : un fond presque blanc à peine teinté, un accent
   * profond. Fait pour laisser les couleurs d'un bouquet exister sans que le
   * site leur dispute l'attention.
   */
  serre: {
    nom: "Serre",
    sombre: false,
    palette: {
      bg: "#fbfcfa",
      surface: "#eef2ea",
      text: "#1a2118",
      muted: "#5d6b58",
      accent: "#2c4a2e",
      accentText: "#fbfcfa",
      border: "#dde5d8",
    },
  },

  /*
   * Le fond de nature morte : un noir chaud, jamais pur. Le noir absolu écrase
   * les rouges et les pourpres d'un bouquet ; ce brun très sombre les laisse
   * respirer.
   */
  velours: {
    nom: "Velours",
    sombre: true,
    palette: {
      bg: "#14100e",
      surface: "#221b17",
      text: "#f4efe9",
      muted: "#a1938a",
      accent: "#c9a227",
      accentText: "#14100e",
      border: "#332822",
    },
  },

  /*
   * Pivoine : un rose poudré tenu par un texte très sombre. La difficulté d'un
   * rose est le contraste — celui-ci est vérifié comme les autres, et l'accent
   * est un prune, pas un rose, sans quoi rien ne se détache.
   */
  pivoine: {
    nom: "Pivoine",
    sombre: false,
    palette: {
      bg: "#fdf7f5",
      surface: "#f7e9e6",
      text: "#231519",
      muted: "#6d5257",
      accent: "#6b2740",
      accentText: "#fdf7f5",
      border: "#eed9d5",
    },
  },

  /* --- Pensées pour les métiers de bouche, ouvertes à tous. -------------- */

  /*
   * Le crème d'un café au lait : un fond chaud, un accent brun torréfié. Le
   * blanc pur donne aux photos de pain et de gâteaux une froideur d'hôpital ;
   * ce fond-là les réchauffe sans les jaunir.
   */
  latte: {
    nom: "Latte",
    sombre: false,
    palette: {
      bg: "#faf5ef",
      surface: "#f1e7da",
      text: "#221a12",
      muted: "#6b5b49",
      accent: "#7b4a24",
      accentText: "#ffffff",
      border: "#e6d9c8",
    },
  },

  /*
   * Le vert pistache des cafés de spécialité — la couleur la plus demandée du
   * moment dans ce métier, et celle qu'un patron de café montre sur son
   * téléphone quand on lui demande ce qu'il aime. Plus franc que « Sauge »,
   * qui est un vert de lin ; celui-ci est un vert de carrelage.
   */
  menthe: {
    nom: "Menthe",
    sombre: false,
    palette: {
      bg: "#f2f7f4",
      surface: "#e2eee7",
      text: "#12211a",
      muted: "#556b60",
      accent: "#14503a",
      accentText: "#f2f7f4",
      border: "#d1e2d8",
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

/* -------------------------------------------------------------------------- */
/* Filtrage par métier                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Les styles proposés à un métier.
 *
 * Un style suppose un type de photographie : « Atelier » veut des gestes et de
 * la matière, « Nature morte » veut des fleurs sur fond sombre. Les proposer
 * tous à tout le monde ferait choisir au commerçant celui qui convient le
 * moins à ses images — et il en conclurait, à juste titre, que son site est
 * raté.
 *
 * Un métier inconnu reçoit tout : mieux vaut trop de choix que pas de page.
 */
export function stylesPour(metierId: string): Record<string, StyleDefini> {
  const retenus = Object.entries(STYLES).filter(([, s]) => s.metiers.includes(metierId));
  return Object.fromEntries(retenus.length > 0 ? retenus : Object.entries(STYLES));
}

/**
 * Les palettes restent ouvertes à tous les métiers.
 *
 * Une couleur ne suppose rien du contenu, à la différence d'une disposition :
 * « Velours » va très bien à un barbier, et « Encre » à un fleuriste. Fermer
 * les palettes par métier retirerait du choix sans rien protéger.
 */
export function palettesPour(_metierId: string): Record<string, PaletteDefinie> {
  return PALETTES;
}
