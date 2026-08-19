import { describe, it, expect } from "vitest";
import { BUSINESS_TYPES } from "./index.ts";
import {
  METIERS,
  metierDe,
  afficheSection,
  prendCommandes,
  styleParDefaut,
} from "./metiers.ts";
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
    expect(metierDe("bakery").id).toBe("patisserie");
    expect(metierDe("restaurant").id).toBe("restaurant");
    expect(metierDe("cafe").id).toBe("cafe");
    expect(metierDe("tattoo_parlor").id).toBe("tatouage");
    expect(metierDe("gym").id).toBe("sport");
    expect(metierDe("other").id).toBe("commerce");
  });

  it("ne laisse aucun type sans métier", () => {
    /*
     * Le schéma et ce fichier peuvent diverger : un type ajouté à l'énumération
     * sans être rangé ici donnerait un site en vitrine sans que personne le
     * décide. Ce test le signale au moment de l'ajout.
     */
    const ranges = new Set(Object.values(METIERS).flatMap((m) => m.types));
    for (const type of BUSINESS_TYPES) {
      expect(ranges.has(type), `type non rangé : ${type}`).toBe(true);
    }
  });

  it("ne range aucun type qui n'existe pas au schéma", () => {
    // L'inverse du précédent : un métier qui réclamerait « boulangerie »
    // plutôt que « bakery » n'attraperait jamais aucun client, et rien ne le
    // dirait — le repli vitrine masque exactement cette faute de frappe.
    const connus = new Set<string>(BUSINESS_TYPES);
    for (const metier of Object.values(METIERS)) {
      for (const type of metier.types) {
        expect(connus.has(type), `type inconnu du schéma : ${type} (${metier.id})`).toBe(true);
      }
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
    expect(metierDe("restaurant").commande).toBe("table");
    expect(metierDe("cafe").commande).toBe("aucun");
  });

  it("range la table avec la commande, et non avec le rendez-vous", () => {
    /*
     * Les deux remplissent la même table `orders` et la même page « Mes
     * commandes » : une intention datée que le commerce rappelle pour
     * confirmer. Quatre endroits du code comparaient à `"commande"` — c'est
     * cette fonction qu'ils lisent désormais, pour qu'un cinquième mode ne
     * demande pas de les retrouver.
     */
    expect(prendCommandes("florist")).toBe(true);
    expect(prendCommandes("restaurant")).toBe(true);
    expect(prendCommandes("hair_salon")).toBe(false);
    expect(prendCommandes("cafe")).toBe(false);
  });
});

describe("sections", () => {
  it("réserve les sections florales au fleuriste", () => {
    for (const section of ["occasions", "deuil", "abonnement", "livraison"] as const) {
      expect(afficheSection("florist", section), section).toBe(true);
      expect(afficheSection("hair_salon", section), section).toBe(false);
    }
  });

  it("donne la carte aux métiers qui en ont une, et à eux seuls", () => {
    // La carte est le premier motif de visite d'un site de restaurant, avant
    // même les photos. Sur un site de coiffeur, elle n'a aucun sens.
    expect(afficheSection("restaurant", "carte")).toBe(true);
    expect(afficheSection("cafe", "carte")).toBe(true);
    expect(afficheSection("hair_salon", "carte")).toBe(false);
    expect(afficheSection("florist", "carte")).toBe(false);
  });

  it("réserve le planning aux salles de cours", () => {
    expect(afficheSection("gym", "planning")).toBe(true);
    expect(afficheSection("yoga_studio", "planning")).toBe(true);
    expect(afficheSection("restaurant", "planning")).toBe(false);
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

  it("dit la même chose des deux côtés", () => {
    /*
     * Deux listes décrivent le même lien : `METIERS[x].styles` et le champ
     * `metiers` de chaque style. La console lit la seconde, la création de
     * client lit la première. Si elles divergent, un style apparaît dans la
     * grille et se fait refuser à l'enregistrement — ou l'inverse, un style
     * par défaut qui n'est jamais proposé.
     */
    for (const metier of Object.values(METIERS)) {
      expect(Object.keys(stylesPour(metier.id)).sort(), metier.id).toEqual(
        [...metier.styles].sort(),
      );
    }
  });

  it("propose au moins trois styles à chaque métier", () => {
    // En dessous, le choix ne se vit pas comme un choix : le commerçant a le
    // sentiment qu'on lui impose un modèle et qu'il paie pour un gabarit.
    for (const metier of Object.values(METIERS)) {
      expect(metier.styles.length, metier.id).toBeGreaterThanOrEqual(3);
    }
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
