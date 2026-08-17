import { describe, expect, it } from "vitest";
import { ThemeConfig } from "./index.ts";
import { STYLES, PALETTES, composerTheme, reconnaitrePreset } from "./presets.ts";

/**
 * Les styles sont choisis dans la console d'un clic, souvent devant le
 * commerçant. Un ensemble mal formé ne se verrait qu'à la construction du site
 * — après la démonstration, et pour tous les clients qui l'auraient retenu.
 */

/** Luminance relative, telle que définie par WCAG. */
function luminance(hex: string): number {
  const canaux = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canaux[0]! + 0.7152 * canaux[1]! + 0.0722 * canaux[2]!;
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe("chaque combinaison donne un thème valide", () => {
  const combinaisons = Object.keys(STYLES).flatMap((style) =>
    Object.keys(PALETTES).map((palette) => [style, palette] as const),
  );

  it.each(combinaisons)("%s + %s", (style, palette) => {
    const theme = composerTheme(style, palette);
    const verdict = ThemeConfig.safeParse(theme);
    expect(verdict.success, JSON.stringify(verdict.error?.issues)).toBe(true);
  });

  it("refuse un nom inconnu plutôt que de composer un thème bancal", () => {
    expect(() => composerTheme("inexistant", "blanc")).toThrow(/style inconnu/);
    expect(() => composerTheme("maison", "inexistante")).toThrow(/palette inconnue/);
  });

  it("garde la trace du choix, pour que la console sache le montrer", () => {
    expect(composerTheme("studio", "sable").preset).toEqual({
      style: "studio",
      palette: "sable",
    });
  });
});

describe("lisibilité des palettes", () => {
  const palettes = Object.entries(PALETTES);

  it.each(palettes)("%s : texte courant au moins 4,5:1", (_id, definie) => {
    expect(contraste(definie.palette.text, definie.palette.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(palettes)("%s : texte secondaire au moins 4,5:1", (_id, definie) => {
    // Le gris des mentions et des libellés est le premier à devenir illisible
    // sur un téléphone en plein soleil, et personne ne le remarque au bureau.
    expect(contraste(definie.palette.muted, definie.palette.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(palettes)("%s : bouton principal au moins 4,5:1", (_id, definie) => {
    expect(
      contraste(definie.palette.accentText, definie.palette.accent),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(palettes)("%s : annonce correctement si elle est sombre", (_id, definie) => {
    // La console s'en sert pour ses aperçus ; une palette mal étiquetée y
    // afficherait du texte blanc sur blanc.
    expect(luminance(definie.palette.bg) < 0.2).toBe(definie.sombre);
  });
});

describe("les styles se distinguent vraiment", () => {
  it("ne partagent pas la même police d'affichage à l'identique", () => {
    // Cinq styles qui se ressemblent ne servent à rien en clientèle : c'est
    // justement le choix qui emporte la décision.
    const polices = Object.values(STYLES).map((s) => s.style.fonts.display);
    expect(new Set(polices).size).toBeGreaterThanOrEqual(4);
  });

  it("proposent plusieurs dispositions de page d'accueil", () => {
    const heros = new Set(Object.values(STYLES).map((s) => s.style.layout.hero));
    expect(heros.size).toBeGreaterThanOrEqual(3);
  });

  it("proposent plusieurs présentations de galerie", () => {
    const galeries = new Set(Object.values(STYLES).map((s) => s.style.layout.gallery));
    expect(galeries.size).toBeGreaterThanOrEqual(3);
  });

  it("décrivent tous à qui ils s'adressent", () => {
    for (const style of Object.values(STYLES)) {
      expect(style.nom.length).toBeGreaterThan(2);
      expect(style.pour.length).toBeGreaterThan(20);
    }
  });
});

describe("dispositions du hero", () => {
  it("chaque disposition annoncée existe dans le schéma", () => {
    // Un nom inventé passerait la validation du style mais casserait le rendu :
    // le template n'a de CSS que pour les dispositions qu'il connaît.
    const connues = new Set(["fullbleed", "split", "minimal", "overlap"]);
    for (const [id, style] of Object.entries(STYLES)) {
      expect(connues.has(style.style.layout.hero), `${id} : ${style.style.layout.hero}`).toBe(true);
    }
  });
});

describe("reconnaissance du thème appliqué", () => {
  it("lit la trace quand elle est là", () => {
    expect(reconnaitrePreset(composerTheme("atelier", "sable"))).toEqual({
      style: "atelier",
      palette: "sable",
    });
  });

  it("retrouve le style par comparaison quand la trace manque", () => {
    // Cas de tous les thèmes réglés à la main, ou écrits avant que cette trace
    // existe : sans cette reconnaissance, la console n'affichait aucune
    // sélection et laissait croire qu'aucun style n'était appliqué.
    const theme = composerTheme("studio", "encre");
    delete (theme as { preset?: unknown }).preset;
    expect(reconnaitrePreset(theme)).toEqual({ style: "studio", palette: "encre" });
  });

  it("ne reconnaît rien dans un thème retouché", () => {
    // Il n'est plus l'un de ces ensembles : le prétendre serait faux.
    const theme = composerTheme("maison", "blanc");
    delete (theme as { preset?: unknown }).preset;
    theme.palette.accent = "#ff0000";
    theme.fonts.displayWeight = 900;
    expect(reconnaitrePreset(theme)).toEqual({ style: undefined, palette: undefined });
  });

  it("reconnaît une couleur même si le style a été retouché", () => {
    const theme = composerTheme("maison", "sauge");
    delete (theme as { preset?: unknown }).preset;
    theme.fonts.displayWeight = 900;
    expect(reconnaitrePreset(theme).palette).toBe("sauge");
    expect(reconnaitrePreset(theme).style).toBeUndefined();
  });
});
