import { describe, expect, it } from "vitest";
import type { SiteConfig } from "@bxl/schema";
import {
  sectionAccueil,
  sectionGalerie,
  sectionEquipe,
  sectionPresentation,
} from "./sections.ts";

/**
 * Le rendu est composé de gabarits de chaîne : une accolade mal placée ne se
 * voit ni au typage ni à l'exécution des routes, seulement à l'écran. Ces
 * tests vérifient ce dont le reste dépend — les noms de champs, qui font le
 * lien avec `contenu.ts`, et l'échappement, qui empêche le contenu d'un client
 * de devenir du balisage.
 */

const site = {
  slug: "demo",
  domain: "demo.exemple.be",
  languages: { default: "fr", available: ["fr", "nl", "en"] },
  business: {
    name: "Maison Verhaeren",
    tagline: { fr: "Barbier" },
    description: { fr: "Un salon." },
    address: { street: "Rue X 1", postalCode: "1000", city: "Bruxelles", country: "BE" },
    phone: "+32 2 511 00 00",
    social: {},
  },
  hero: { image: "hero.jpg", headline: { fr: "Titre", nl: "Titel" } },
  gallery: [{ src: "a.jpg", alt: { fr: "A" } }],
  team: [{ name: "Lucas", role: { fr: "Barbier" }, photo: "l.jpg" }],
  reviews: [],
  services: [],
  seo: {},
} as unknown as SiteConfig;

describe("noms des champs", () => {
  it("l'accueil expose les clés que sait relire contenu.ts", () => {
    const html = sectionAccueil("demo", site, "fr");
    expect(html).toContain('name="hero.image"');
    expect(html).toContain('name="hero.headline.fr"');
    expect(html).toContain('name="hero.headline.nl"');
    expect(html).toContain('name="hero.headline.en"');
  });

  it("les listes numérotent leurs champs", () => {
    expect(sectionGalerie("demo", site, "fr")).toContain('name="gallery.0.src"');
    expect(sectionEquipe("demo", site, "fr")).toContain('name="team.0.name"');
  });

  it("chaque liste fournit un modèle pour l'ajout", () => {
    // Sans ce modèle, le bouton « Ajouter » n'a rien à cloner et ne fait rien.
    expect(sectionGalerie("demo", site, "fr")).toContain('data-modele="gallery"');
    expect(sectionEquipe("demo", site, "fr")).toContain('data-modele="team"');
  });
});

describe("valeurs existantes", () => {
  it("repose le contenu du site dans les champs", () => {
    const html = sectionAccueil("demo", site, "fr");
    expect(html).toContain('value="Titre"');
    expect(html).toContain('value="Titel"');
  });

  it("montre l'aperçu de la photo déjà choisie", () => {
    expect(sectionEquipe("demo", site, "fr")).toContain("/clients/demo/media/l.jpg");
  });

  it("signale les langues déjà remplies", () => {
    const html = sectionAccueil("demo", site, "fr");
    // fr et nl sont renseignés, en ne l'est pas.
    expect(html.match(/data-rempli="true"/g)?.length).toBe(2);
  });
});

describe("échappement", () => {
  it("neutralise le balisage venu du contenu d'un client", () => {
    const piege = {
      ...site,
      business: { ...site.business, name: '"><script>alert(1)</script>' },
    } as unknown as SiteConfig;

    const html = sectionPresentation("demo", piege, "fr");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
