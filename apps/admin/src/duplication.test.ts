import { describe, it, expect } from "vitest";
import { SiteConfig } from "@bxl/schema";
import { dupliquer, validerCopie, coordonneesPartagees } from "./duplication.ts";

/**
 * L'unicité des données, testée champ par champ.
 *
 * Chacun de ces cas décrit une confusion qui ne produirait **aucune erreur** :
 * la copie fonctionnerait parfaitement, et se tromperait de commerce. C'est
 * exactement le genre de défaut qu'on découvre chez un client, des semaines
 * plus tard.
 */

const modele = (): Record<string, any> => ({
  slug: "maison-verhaeren",
  status: "live",
  plan: "pro",
  demo: false,
  tenantId: "3f1b7c2e-9d4a-4f8b-8c1e-0a2b6d5e7f30",
  domain: "maison-verhaeren.be",
  aliases: ["www.maison-verhaeren.be", "verhaeren.hairbxl.be"],
  languages: { default: "fr", available: ["fr"] },
  business: {
    name: "Maison Verhaeren",
    type: "barbershop",
    description: { fr: "Un barbier de quartier." },
    address: { street: "Rue Haute 12", postalCode: "1000", city: "Bruxelles" },
    phone: "+32 2 111 11 11",
    email: "contact@verhaeren.be",
    social: { instagram: "https://instagram.com/verhaeren" },
    googleMapsUrl: "https://maps.google.com/?cid=123",
    googlePlaceId: "ChIJverhaeren",
  },
  hero: { image: "hero.jpg", headline: { fr: "Maison Verhaeren" } },
  hours: {
    monday: [],
    tuesday: [{ open: "09:00", close: "18:00" }],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  },
  services: [
    { id: "coupe", name: { fr: "Coupe" }, durationMin: 30, price: 28, priceFrom: false },
  ],
  gallery: [{ src: "galerie-1.jpg", alt: { fr: "Le salon" } }],
  team: [{ name: "Lucas", role: { fr: "Barbier" } }],
  reviews: [
    { author: "Sophie", rating: 5, text: { fr: "Excellent." }, source: "google" },
  ],
  legal: {
    companyName: "Maison Verhaeren SRL",
    legalForm: "SRL",
    registrationNumber: "0123.456.789",
    vatNumber: "BE0123.456.789",
  },
  booking: { mode: "none" },
  seo: {},
  contact: {},
});

const vers = { slug: "salon-marie", nom: "Salon Marie", domaine: "salon-marie.hairbxl.be" };

describe("identité", () => {
  it("régénère l'identifiant du commerce", () => {
    /*
     * Le plus grave de tous. C'est la clé sous laquelle l'API range les
     * rendez-vous, les messages et les commandes : partagée, les deux salons
     * reçoivent le courrier l'un de l'autre — sans la moindre erreur, sans
     * qu'aucun journal ne s'en émeuve.
     */
    const source = modele();
    const copie = dupliquer(source, vers);
    expect(copie.tenantId).not.toBe(source.tenantId);
    expect(copie.site.tenantId).toBe(copie.tenantId);
    expect(copie.tenantId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("donne un identifiant différent à chaque duplication", () => {
    expect(dupliquer(modele(), vers).tenantId).not.toBe(
      dupliquer(modele(), vers).tenantId,
    );
  });

  it("pose le nouveau nom, la nouvelle adresse, et vide les alias", () => {
    // Les alias appartiennent au domaine d'origine : les reprendre ferait
    // rediriger le site du modèle vers la copie.
    const copie = dupliquer(modele(), vers);
    expect(copie.site.slug).toBe("salon-marie");
    expect(copie.site.domain).toBe("salon-marie.hairbxl.be");
    expect(copie.site.aliases).toEqual([]);
    expect((copie.site.business as Record<string, unknown>).name).toBe("Salon Marie");
  });

  it("naît en brouillon, jamais en ligne", () => {
    // C'est ce qui laisse le temps de corriger tout ce qui désigne encore
    // l'autre commerce : rien n'est servi tant qu'on n'a pas publié.
    const copie = dupliquer({ ...modele(), status: "live" }, vers);
    expect(copie.site.status).toBe("draft");
  });

  it("ne reprend pas le drapeau de démonstration", () => {
    // Dupliquer le site de démonstration pour un vrai client ne doit pas lui
    // coller le bandeau « commerce fictif » ni le refus d'indexation.
    const copie = dupliquer({ ...modele(), demo: true }, vers);
    expect(copie.site.demo).toBe(false);
  });
});

describe("ce qui appartient au commerce d'origine", () => {
  it("n'emporte pas les avis", () => {
    /*
     * Les recopier publierait des témoignages qu'aucun client de ce
     * commerce-ci n'a écrits. Ce n'est pas une négligence, c'est un faux.
     */
    const copie = dupliquer(modele(), vers);
    expect(copie.site.reviews).toEqual([]);
    expect(copie.retire.join(" ")).toContain("avis");
  });

  it("n'emporte pas les mentions légales", () => {
    // Numéro d'entreprise et TVA d'une autre société.
    const copie = dupliquer(modele(), vers);
    expect(copie.site.legal).toBeUndefined();
    expect(copie.retire.join(" ")).toContain("mentions légales");
  });

  it("n'emporte pas les liens Google", () => {
    // Ils partent dans les données structurées : déclarer le `placeId` du
    // voisin, c'est dire à Google qu'on *est* le voisin.
    const business = dupliquer(modele(), vers).site.business as Record<string, unknown>;
    expect(business.googleMapsUrl).toBeUndefined();
    expect(business.googlePlaceId).toBeUndefined();
  });

  it("n'emporte pas les réseaux sociaux", () => {
    const business = dupliquer(modele(), vers).site.business as Record<string, unknown>;
    expect(business.social).toEqual({});
  });

  it("annonce tout ce qu'il a retiré", () => {
    // Retirer en silence serait pire que tout : l'exploitant croirait avoir
    // une copie conforme.
    const copie = dupliquer(modele(), vers);
    expect(copie.retire.length).toBe(4);
  });

  it("ne signale rien quand il n'y avait rien à retirer", () => {
    const nu = modele();
    nu.reviews = [];
    delete nu.legal;
    nu.business.social = {};
    delete nu.business.googleMapsUrl;
    delete nu.business.googlePlaceId;
    expect(dupliquer(nu, vers).retire).toEqual([]);
  });
});

describe("ce qui est repris", () => {
  it("garde le contenu, qui est tout l'intérêt", () => {
    const copie = dupliquer(modele(), vers);
    expect(copie.site.services).toHaveLength(1);
    expect(copie.site.gallery).toHaveLength(1);
    expect(copie.site.team).toHaveLength(1);
    expect((copie.site.hours as Record<string, unknown[]>).tuesday).toHaveLength(1);
    expect((copie.site.business as Record<string, unknown>).description).toEqual({
      fr: "Un barbier de quartier.",
    });
  });

  it("recopie les coordonnées, qui servent de repère", () => {
    // Volontaire : un formulaire de contact sans destinataire est refusé plus
    // loin dans la chaîne, et la saisie est plus sûre en corrigeant qu'en
    // repartant de rien. Le site reste hors ligne jusqu'à la mise en ligne.
    const business = dupliquer(modele(), vers).site.business as Record<string, unknown>;
    expect(business.phone).toBe("+32 2 111 11 11");
    expect(business.email).toBe("contact@verhaeren.be");
  });
});

describe("titre d'accueil", () => {
  it("suit le nouveau nom quand il ne portait que l'ancien", () => {
    const titres = (dupliquer(modele(), vers).site.hero as Record<string, unknown>)
      .headline as Record<string, string>;
    expect(titres.fr).toBe("Salon Marie");
  });

  it("laisse une vraie accroche intacte", () => {
    /*
     * « Barbier à Saint-Gilles depuis 1998 » est du contenu, et c'est
     * justement ce qu'on vient chercher en dupliquant. Le remplacer par le nom
     * du commerce appauvrirait la copie sans qu'on l'ait demandé.
     */
    const source = modele();
    source.hero.headline = { fr: "Barbier à Saint-Gilles depuis 1998" };
    const titres = (dupliquer(source, vers).site.hero as Record<string, unknown>)
      .headline as Record<string, string>;
    expect(titres.fr).toBe("Barbier à Saint-Gilles depuis 1998");
  });
});

describe("indépendance des deux fichiers", () => {
  it("ne modifie pas le modèle", () => {
    // Sans copie profonde, vider les avis de la copie viderait ceux du site
    // d'origine — qui est en ligne.
    const source = modele();
    dupliquer(source, vers);
    expect(source.reviews).toHaveLength(1);
    expect(source.legal).toBeDefined();
    expect(source.business.social).toEqual({ instagram: "https://instagram.com/verhaeren" });
    expect(source.slug).toBe("maison-verhaeren");
  });

  it("ne partage aucun sous-objet avec le modèle", () => {
    const source = modele();
    const copie = dupliquer(source, vers);
    (copie.site.services as Array<Record<string, unknown>>)[0]!.price = 99;
    expect(source.services[0]!.price).toBe(28);
  });
});

describe("validation", () => {
  it("produit un fichier que le schéma accepte", () => {
    const copie = dupliquer(modele(), vers);
    expect(validerCopie(copie.site)).toEqual({ ok: true });
    expect(SiteConfig.parse(copie.site).slug).toBe("salon-marie");
  });

  it("dupliquer un fleuriste garde ses sections propres", () => {
    const fleuriste = {
      ...modele(),
      business: { ...modele().business, type: "florist" },
      services: [{ id: "bouquet", name: { fr: "Bouquet" }, price: 25, priceFrom: true }],
      occasions: [{ id: "mariage", title: { fr: "Mariage" }, price: 180 }],
      delivery: { zones: ["Ixelles"], cutoff: "14:00", fee: 7 },
      mourning: { text: { fr: "Couronnes et gerbes." }, venues: ["Funérarium d'Ixelles"] },
      subscriptions: [
        { id: "hebdo", name: { fr: "Chaque semaine" }, rhythm: { fr: "Une fois par semaine" }, price: 32 },
      ],
    };
    const copie = dupliquer(fleuriste, vers);
    expect(validerCopie(copie.site)).toEqual({ ok: true });
    expect(copie.site.occasions).toHaveLength(1);
    expect(copie.site.delivery).toBeDefined();
    expect(copie.site.mourning).toBeDefined();
    expect(copie.site.subscriptions).toHaveLength(1);
  });
});

describe("coordonneesPartagees", () => {
  const site = { business: { phone: "+32 2 111 11 11", email: "contact@verhaeren.be" } };

  it("repère un téléphone et un e-mail restés ceux d'un autre commerce", () => {
    /*
     * Le danger propre à la duplication : les deux valeurs sont parfaitement
     * valides, le site fonctionne, et les demandes de contact partent chez le
     * voisin. Seule la comparaison peut le dire.
     */
    const trouve = coordonneesPartagees(site, [
      { slug: "maison-verhaeren", nom: "Maison Verhaeren", phone: "+32 2 111 11 11", email: "contact@verhaeren.be" },
    ]);
    expect(trouve).toEqual(["le téléphone et l'e-mail de Maison Verhaeren"]);
  });

  it("ignore la ponctuation du numéro", () => {
    // « +32 2 111 11 11 » et « 02/111.11.11 » ne se ressemblent pas à l'octet
    // près : une comparaison littérale déclarerait le problème résolu.
    const trouve = coordonneesPartagees({ business: { phone: "02/111.11.11" } }, [
      { slug: "x", nom: "Maison Verhaeren", phone: "+32 2 111 11 11" },
    ]);
    expect(trouve).toEqual(["le téléphone de Maison Verhaeren"]);
  });

  it("ne dit rien quand les coordonnées ont été corrigées", () => {
    const trouve = coordonneesPartagees(
      { business: { phone: "+32 2 222 22 22", email: "bonjour@marie.be" } },
      [{ slug: "x", nom: "Maison Verhaeren", phone: "+32 2 111 11 11", email: "contact@verhaeren.be" }],
    );
    expect(trouve).toEqual([]);
  });

  it("ne confond pas une absence d'e-mail avec une correspondance", () => {
    // Deux commerces sans e-mail ne partagent rien : une chaîne vide comparée
    // à une chaîne vide aurait déclaré un doublon sur toute la liste.
    const trouve = coordonneesPartagees({ business: { phone: "+32 2 222 22 22" } }, [
      { slug: "x", nom: "Autre", phone: "+32 2 333 33 33" },
    ]);
    expect(trouve).toEqual([]);
  });

  it("nomme chaque commerce concerné", () => {
    const trouve = coordonneesPartagees(site, [
      { slug: "a", nom: "Premier", phone: "+32 2 111 11 11" },
      { slug: "b", nom: "Second", email: "contact@verhaeren.be", phone: "+32 2 999 99 99" },
    ]);
    expect(trouve).toEqual(["le téléphone de Premier", "l'e-mail de Second"]);
  });
});
