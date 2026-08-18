import { describe, it, expect } from "vitest";
import { METIERS, metierDe, afficheSection, styleParDefaut } from "./metiers.ts";
import { STYLES, stylesPour, palettesPour } from "./presets.ts";

/**
 * Le métier commande tout le reste : le vocabulaire du site, les sections
 * affichées, les styles proposés, les visuels de remplacement. Une erreur ici
 * ne casse rien — elle produit un site de fleuriste qui parle de rendez-vous,
 * ce qui est pire.
 */

describe("metierDe", () => {
  it("range chaque type de commerce dans un métier", () => {
    expect(metierDe("hair_salon").id).toBe("soins");
    expect(metierDe("barbershop").id).toBe("soins");
    expect(metierDe("beauty_salon").id).toBe("soins");
    expect(metierDe("florist").id).toBe("fleuriste");
    expect(metierDe("bakery").id).toBe("commerce");
  });

  it("ne laisse aucun type sans métier", () => {
    /*
     * Le schéma et ce fichier peuvent diverger : un type ajouté à l'énumération
     * sans être rangé ici donnerait un site en vitrine sans que personne le
     * décide. Ce test le signale au moment de l'ajout.
     */
    const types = ["hair_salon", "barbershop", "beauty_salon", "florist", "bakery", "other"];
    const ranges = new Set(Object.values(METIERS).flatMap((m) => m.types));
    for (const type of types) {
      expect(ranges.has(type), `type non rangé : ${type}`).toBe(true);
    }
  });

  it("retombe sur la vitrine plutôt que d'échouer", () => {
    // Un type inconnu ne doit pas empêcher un site de se construire : mieux
    // vaut une vitrine qu'une page absente.
    expect(metierDe("brasserie-artisanale").id).toBe("commerce");
    expect(metierDe("").id).toBe("commerce");
  });

  it("n'attribue jamais deux métiers au même type", () => {
    const vus = new Set<string>();
    for (const metier of Object.values(METIERS)) {
      for (const type of metier.types) {
        expect(vus.has(type), `type en double : ${type}`).toBe(false);
        vus.add(type);
      }
    }
  });
});

describe("mode de commande", () => {
  it("distingue le rendez-vous de la commande", () => {
    // C'est la différence structurante : un fleuriste ne réserve pas un
    // créneau, il reçoit une intention et rappelle.
    expect(metierDe("hair_salon").commande).toBe("rendez-vous");
    expect(metierDe("florist").commande).toBe("commande");
    expect(metierDe("bakery").commande).toBe("aucun");
  });
});

describe("sections", () => {
  it("réserve les sections florales au fleuriste", () => {
    for (const section of ["occasions", "deuil", "abonnement", "livraison"] as const) {
      expect(afficheSection("florist", section), section).toBe(true);
      expect(afficheSection("hair_salon", section), section).toBe(false);
    }
  });

  it("garde le déroulé et l'équipe pour les soins", () => {
    expect(afficheSection("hair_salon", "deroule")).toBe(true);
    expect(afficheSection("florist", "deroule")).toBe(false);
    // L'équipe vaut pour les deux : un fleuriste montre qui compose.
    expect(afficheSection("florist", "equipe")).toBe(true);
  });
});

describe("styles proposés", () => {
  it("ne propose au fleuriste que des styles faits pour lui", () => {
    const fleuriste = Object.keys(stylesPour("fleuriste"));
    expect(fleuriste).toEqual(["serre", "naturemorte", "marche", "herbier"]);
    expect(fleuriste).not.toContain("nuit");
  });

  it("laisse les styles de coiffure aux soins", () => {
    expect(Object.keys(stylesPour("soins"))).toEqual([
      "maison",
      "atelier",
      "studio",
      "signature",
      "nuit",
    ]);
  });

  it("déclare tous les styles listés par un métier", () => {
    /*
     * Un métier qui nommerait un style inexistant afficherait une grille vide,
     * et la création de client échouerait sur un style introuvable.
     */
    for (const metier of Object.values(METIERS)) {
      for (const style of metier.styles) {
        expect(STYLES[style], `style inconnu : ${style} (${metier.id})`).toBeDefined();
      }
    }
  });

  it("étiquette chaque style d'au moins un métier", () => {
    // Un style sans métier n'apparaîtrait nulle part : du code mort qu'aucune
    // page ne montrerait, et que personne ne remarquerait.
    for (const [id, style] of Object.entries(STYLES)) {
      expect(style.metiers.length, `style orphelin : ${id}`).toBeGreaterThan(0);
    }
  });

  it("donne un style par défaut qui existe", () => {
    for (const id of Object.keys(METIERS)) {
      expect(STYLES[styleParDefaut(id)], id).toBeDefined();
    }
  });

  it("laisse toutes les palettes ouvertes à tous", () => {
    // Une couleur ne suppose rien du contenu, à la différence d'une
    // disposition : fermer les palettes retirerait du choix sans rien protéger.
    expect(Object.keys(palettesPour("fleuriste"))).toEqual(Object.keys(palettesPour("soins")));
  });
});

describe("vocabulaire", () => {
  it("remplace les mots qui ne veulent rien dire chez un fleuriste", () => {
    const mots = METIERS.fleuriste!.vocabulaire;
    expect(mots.services_title?.fr).toBe("Nos compositions");
    expect(mots.book?.fr).toBe("Commander");
  });

  it("traduit chaque remplacement dans les trois langues", () => {
    /*
     * Une clé traduite en français seulement retomberait sur le libellé commun
     * en néerlandais : un site bilingue afficherait « Nos compositions » d'un
     * côté et « Prestaties & tarieven » de l'autre, sans que rien ne le
     * signale.
     */
    for (const metier of Object.values(METIERS)) {
      for (const [cle, textes] of Object.entries(metier.vocabulaire)) {
        for (const langue of ["fr", "nl", "en"] as const) {
          expect(
            textes[langue],
            `${metier.id}.${cle} : ${langue} manquant`,
          ).toBeTruthy();
        }
      }
    }
  });
});
