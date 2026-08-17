import { describe, it, expect } from "vitest";
import { SiteConfig } from "@bxl/schema";
import { reconnaitrePreset } from "@bxl/schema/presets";
import {
  identifiant,
  squelette,
  valider,
  resteAFaire,
  TYPES_COMMERCE,
  type DemandeNouveauClient,
} from "./nouveau.ts";

const demande = (surcharge: Partial<DemandeNouveauClient> = {}): DemandeNouveauClient => ({
  slug: "salon-marie",
  nom: "Salon Marie",
  type: "hair_salon",
  domaine: "salon-marie.hairbxl.be",
  telephone: "+32 2 123 45 67",
  email: "contact@salonmarie.be",
  rue: "Rue Haute 12",
  codePostal: "1000",
  ville: "Bruxelles",
  plan: "essentiel",
  langues: ["fr"],
  style: "maison",
  palette: "blanc",
  ...surcharge,
});

describe("identifiant", () => {
  it("translittère les accents au lieu de les couper", () => {
    // Le piège : une suppression naïve des caractères non ASCII transforme
    // « Émilie » en « milie », et le client découvre son adresse amputée.
    expect(identifiant("Salon Émilie")).toBe("salon-emilie");
    expect(identifiant("Chez Loïc")).toBe("chez-loic");
    expect(identifiant("Cœur de Bruxelles")).toBe("coeur-de-bruxelles");
    expect(identifiant("Straße 12")).toBe("strasse-12");
  });

  it("réduit la ponctuation à des tirets, sans en laisser aux extrémités", () => {
    expect(identifiant("L'Atelier du Barbier")).toBe("l-atelier-du-barbier");
    expect(identifiant("  Marie & Co.  ")).toBe("marie-co");
    expect(identifiant("--Salon--")).toBe("salon");
  });

  it("produit toujours un identifiant que le schéma accepte", () => {
    const noms = [
      "Salon Émilie",
      "L'Atelier",
      "Marie & Co.",
      "BARBER 1892",
      "Coiffure ***",
      "Ô",
    ];
    for (const nom of noms) {
      const slug = identifiant(nom);
      if (slug === "") continue;
      expect(slug, nom).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("renvoie une chaîne vide quand il ne reste rien d'utilisable", () => {
    // La route s'en sert pour refuser plutôt que pour fabriquer un nom : un
    // dossier nommé au hasard serait introuvable ensuite.
    expect(identifiant("***")).toBe("");
    expect(identifiant("   ")).toBe("");
  });

  it("borne la longueur sans laisser de tiret en bout", () => {
    const slug = identifiant("Salon de coiffure et barbier de la place communale");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("squelette", () => {
  it("passe la validation du schéma, comme le ferait le build", () => {
    expect(valider(squelette(demande()))).toEqual({ ok: true });
  });

  it("accepte chaque type de commerce proposé au formulaire", () => {
    for (const type of Object.keys(TYPES_COMMERCE) as Array<keyof typeof TYPES_COMMERCE>) {
      expect(valider(squelette(demande({ type }))), type).toEqual({ ok: true });
    }
  });

  it("naît « en préparation » et jamais « en ligne »", () => {
    /*
     * Le cœur du dispositif : un site créé en clientèle est visible à son
     * adresse mais refusé à Google. Passé directement en « live », il ferait
     * du squelette — « À compléter » sous le nom du commerçant — le premier
     * résultat pour le nom du salon.
     */
    const site = SiteConfig.parse(squelette(demande()).site);
    expect(site.status).toBe("preview");
    expect(site.demo).toBe(false);
  });

  it("n'invente ni prestation, ni tarif, ni horaire", () => {
    const site = SiteConfig.parse(squelette(demande()).site);
    expect(site.services).toEqual([]);
    expect(site.team).toEqual([]);
    expect(site.gallery).toEqual([]);
    expect(Object.values(site.hours).every((jour) => jour.length === 0)).toBe(true);
  });

  it("reprend mot pour mot ce que le commerçant a dicté", () => {
    const site = SiteConfig.parse(squelette(demande()).site);
    expect(site.business.name).toBe("Salon Marie");
    expect(site.business.phone).toBe("+32 2 123 45 67");
    expect(site.business.email).toBe("contact@salonmarie.be");
    expect(site.business.address.street).toBe("Rue Haute 12");
    expect(site.business.address.city).toBe("Bruxelles");
    expect(site.domain).toBe("salon-marie.hairbxl.be");
    // Le titre de la page d'accueil est le nom exact, pas une accroche
    // inventée : c'est vrai, et ça évite d'ouvrir sur « À compléter ».
    expect(site.hero.headline.fr).toBe("Salon Marie");
  });

  it("génère un tenantId, sans quoi le formulaire de contact n'existerait pas", () => {
    const s = squelette(demande());
    expect(s.tenantId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(SiteConfig.parse(s.site).tenantId).toBe(s.tenantId);
  });

  it("donne un tenantId différent à chaque client", () => {
    // Deux commerces partageant le même identifiant recevraient les
    // rendez-vous l'un de l'autre.
    expect(squelette(demande()).tenantId).not.toBe(squelette(demande()).tenantId);
  });

  it("applique le style et la couleur choisis", () => {
    const s = squelette(demande({ style: "atelier", palette: "sable" }));
    expect(reconnaitrePreset(s.theme)).toEqual({ style: "atelier", palette: "sable" });
  });

  it("prend la première langue cochée comme langue principale", () => {
    const site = SiteConfig.parse(squelette(demande({ langues: ["fr", "nl"] })).site);
    expect(site.languages.default).toBe("fr");
    expect(site.languages.available).toEqual(["fr", "nl"]);
    // Le texte obligatoire est écrit dans la langue principale : le schéma
    // refuse un site dont la langue par défaut n'est pas remplie.
    expect(site.business.description.fr).toBeTruthy();
  });

  it("écrit les textes dans la langue principale, même si ce n'est pas le français", () => {
    const site = SiteConfig.parse(squelette(demande({ langues: ["nl"] })).site);
    expect(site.languages.default).toBe("nl");
    expect(site.hero.headline.nl).toBe("Salon Marie");
    expect(site.business.description.nl).toBeTruthy();
  });

  it("refuse un style inconnu plutôt que d'en choisir un au hasard", () => {
    expect(() => squelette(demande({ style: "inexistant" }))).toThrow();
  });
});

describe("resteAFaire", () => {
  it("énumère tout ce qui manque à un site qui vient de naître", () => {
    const site = SiteConfig.parse(squelette(demande()).site);
    const manque = resteAFaire(site);

    expect(manque).toContain("la présentation du commerce");
    expect(manque).toContain("les horaires d'ouverture");
    expect(manque).toContain("les prestations et leurs tarifs");
    expect(manque).toContain("les photos du salon");
    expect(manque).toContain("les mentions légales (obligatoires en Belgique)");
  });

  it("compte « À compléter » comme non rempli", () => {
    // Un texte laissé au squelette est pire qu'un texte vide : il s'affiche.
    const brut = squelette(demande()).site as Record<string, any>;
    brut.business.description = { fr: "à compléter" };
    expect(resteAFaire(SiteConfig.parse(brut))).toContain("la présentation du commerce");
  });

  it("ne réclame plus rien quand tout est renseigné", () => {
    const brut = squelette(demande()).site as Record<string, any>;
    brut.business.description = { fr: "Salon de quartier ouvert depuis 1998." };
    brut.business.tagline = { fr: "Coupe et couleur à Bruxelles" };
    brut.hours.tuesday = [{ open: "09:00", close: "18:00" }];
    brut.services = [
      { id: "coupe", name: { fr: "Coupe" }, durationMin: 30, price: 25 },
    ];
    brut.gallery = [{ src: "galerie-1.jpg", alt: { fr: "Le salon" } }];
    brut.legal = { companyName: "Salon Marie SRL" };

    expect(resteAFaire(SiteConfig.parse(brut))).toEqual([]);
  });

  it("lit la langue principale du site, pas le français par défaut", () => {
    /*
     * L'accroche n'est pas exigée par le schéma, à la différence de la
     * description : c'est donc elle qui peut se retrouver traduite en français
     * dans un site néerlandophone, et passer inaperçue.
     */
    const brut = squelette(demande({ langues: ["nl"] })).site as Record<string, any>;
    brut.business.tagline = { fr: "Rempli en français seulement" };
    expect(resteAFaire(SiteConfig.parse(brut))).toContain("l'accroche sous le titre");

    brut.business.tagline = { nl: "Kapsalon in Brussel" };
    expect(resteAFaire(SiteConfig.parse(brut))).not.toContain("l'accroche sous le titre");
  });
});
