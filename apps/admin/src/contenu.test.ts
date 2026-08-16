import { describe, expect, it } from "vitest";
import { appliquerSection, texteTraduit, indices, estSection } from "./contenu.ts";

/**
 * Ces tests portent sur ce que l'éditeur écrit dans `site.json`.
 *
 * Deux risques dominent, et ils sont muets tous les deux : effacer une
 * traduction qu'aucun champ n'affichait, et emporter une clé qu'aucun
 * formulaire n'expose. L'un comme l'autre se découvriraient à la mise en ligne
 * suivante, chez le client.
 */

const siteComplet = () => ({
  slug: "demo",
  status: "live",
  plan: "signature",
  tenantId: "abc",
  domain: "demo.exemple.be",
  languages: { default: "fr", available: ["fr", "nl", "en"] },
  business: {
    name: "Maison Verhaeren",
    type: "barbershop",
    tagline: { fr: "Barbier", nl: "Barbier", en: "Barbershop" },
    description: { fr: "Un salon.", nl: "Een zaak.", en: "A shop." },
    address: { street: "Rue X 1", postalCode: "1000", city: "Bruxelles", country: "BE" },
    geo: { lat: 50.85, lng: 4.34 },
    phone: "+32 2 511 00 00",
    social: { instagram: "https://instagram.com/x" },
    googlePlaceId: "place-123",
  },
  hero: { image: "hero.jpg", headline: { fr: "Titre", nl: "Titel" } },
  gallery: [
    { src: "a.jpg", alt: { fr: "A" } },
    { src: "b.jpg", alt: { fr: "B" } },
  ],
  team: [{ name: "Lucas", role: { fr: "Barbier" }, photo: "l.jpg" }],
  reviews: [{ author: "Sophie", rating: 5, text: { fr: "Super" }, source: "google" }],
  services: [
    { id: "coupe", name: { fr: "Coupe" }, durationMin: 30, price: 28, priceFrom: false },
    { id: "barbe", name: { fr: "Barbe" }, durationMin: 20, price: null, priceFrom: false },
  ],
  seo: { title: { fr: "T" } },
});

describe("texteTraduit", () => {
  it("ne retient que les langues renseignées", () => {
    expect(texteTraduit({ "x.fr": "Bonjour", "x.nl": "  ", "x.en": "" }, "x")).toEqual({
      fr: "Bonjour",
    });
  });

  it("coupe les espaces autour", () => {
    expect(texteTraduit({ "x.fr": "  Bonjour  " }, "x")).toEqual({ fr: "Bonjour" });
  });
});

describe("indices", () => {
  it("les trie et les dédoublonne", () => {
    const champs = { "g.2.src": "c", "g.0.src": "a", "g.0.alt.fr": "A", "g.1.src": "b" };
    expect(indices(champs, "g")).toEqual([0, 1, 2]);
  });

  it("tolère les trous d'un envoi sans JavaScript", () => {
    expect(indices({ "g.0.src": "a", "g.7.src": "b" }, "g")).toEqual([0, 7]);
  });

  it("ne confond pas deux préfixes qui commencent pareil", () => {
    expect(indices({ "team.0.name": "L", "teamx.0.name": "X" }, "team")).toEqual([0]);
  });
});

describe("accueil", () => {
  it("écrit l'image et le titre", () => {
    const raw = siteComplet();
    appliquerSection(raw, "accueil", {
      "hero.image": "neuve.jpg",
      "hero.headline.fr": "Nouveau titre",
      "hero.headline.nl": "Nieuwe titel",
    });
    expect(raw.hero.image).toBe("neuve.jpg");
    expect(raw.hero.headline).toEqual({ fr: "Nouveau titre", nl: "Nieuwe titel" });
  });

  it("retire un sous-titre vidé plutôt que d'écrire un objet vide", () => {
    const raw = siteComplet() as Record<string, any>;
    raw.hero.subline = { fr: "ancien" };
    appliquerSection(raw, "accueil", {
      "hero.image": "hero.jpg",
      "hero.headline.fr": "Titre",
      "hero.subline.fr": "",
    });
    expect("subline" in raw.hero).toBe(false);
  });
});

describe("présentation", () => {
  it("ne touche à aucune clé que le formulaire n'expose", () => {
    // geo, type, googlePlaceId n'ont pas de champ : les emporter priverait le
    // site de sa carte et de sa fiche Google sans le moindre message.
    const raw = siteComplet();
    appliquerSection(raw, "presentation", {
      "business.name": "Maison V",
      "business.description.fr": "Un salon.",
      "business.phone": "+32 2 000 00 00",
      "business.address.street": "Rue Y 2",
      "business.address.postalCode": "1000",
      "business.address.city": "Bruxelles",
    });
    expect(raw.business.geo).toEqual({ lat: 50.85, lng: 4.34 });
    expect(raw.business.type).toBe("barbershop");
    expect(raw.business.googlePlaceId).toBe("place-123");
    expect(raw.business.address.country).toBe("BE");
    expect(raw.business.phone).toBe("+32 2 000 00 00");
  });

  it("supprime un réseau social vidé", () => {
    const raw = siteComplet();
    appliquerSection(raw, "presentation", {
      "business.name": "M",
      "business.description.fr": "d",
      "business.phone": "+32",
      "business.address.street": "r",
      "business.address.postalCode": "1000",
      "business.address.city": "B",
      "business.social.instagram": "",
    });
    expect("instagram" in raw.business.social).toBe(false);
  });
});

describe("galerie", () => {
  it("reconstruit les photos dans l'ordre reçu", () => {
    const raw = siteComplet();
    appliquerSection(raw, "galerie", {
      "gallery.0.src": "b.jpg",
      "gallery.0.alt.fr": "B",
      "gallery.1.src": "a.jpg",
      "gallery.1.alt.fr": "A",
    });
    expect(raw.gallery.map((p: { src: string }) => p.src)).toEqual(["b.jpg", "a.jpg"]);
  });

  it("écarte un emplacement resté sans image", () => {
    // Le conserver produirait une photo sans fichier, et la construction du
    // site échouerait — après coup, loin de la saisie qui l'a causée.
    const raw = siteComplet();
    appliquerSection(raw, "galerie", {
      "gallery.0.src": "a.jpg",
      "gallery.0.alt.fr": "A",
      "gallery.1.src": "",
      "gallery.1.alt.fr": "orpheline",
    });
    expect(raw.gallery).toHaveLength(1);
  });

  it("accepte une galerie vidée", () => {
    const raw = siteComplet();
    appliquerSection(raw, "galerie", {});
    expect(raw.gallery).toEqual([]);
  });
});

describe("équipe", () => {
  it("garde le rôle traduit et la photo", () => {
    const raw = siteComplet();
    appliquerSection(raw, "equipe", {
      "team.0.name": "Sofia",
      "team.0.role.fr": "Barbière",
      "team.0.role.nl": "Barbier",
      "team.0.photo": "s.jpg",
    });
    expect(raw.team).toEqual([
      { name: "Sofia", role: { fr: "Barbière", nl: "Barbier" }, photo: "s.jpg" },
    ]);
  });

  it("omet la photo et le rôle absents plutôt que d'écrire du vide", () => {
    const raw = siteComplet();
    appliquerSection(raw, "equipe", { "team.0.name": "Ahmed", "team.0.photo": "" });
    expect(raw.team).toEqual([{ name: "Ahmed" }]);
  });

  it("écarte une ligne ajoutée puis laissée sans nom", () => {
    const raw = siteComplet();
    appliquerSection(raw, "equipe", {
      "team.0.name": "Lucas",
      "team.1.name": "   ",
      "team.1.role.fr": "Barbier",
    });
    expect(raw.team).toHaveLength(1);
  });
});

describe("avis", () => {
  it("convertit la note en nombre", () => {
    const raw = siteComplet();
    appliquerSection(raw, "avis", {
      "reviews.0.author": "Marc",
      "reviews.0.rating": "4",
      "reviews.0.text.fr": "Très bien",
      "reviews.0.source": "facebook",
    });
    expect(raw.reviews[0]).toEqual({
      author: "Marc",
      rating: 4,
      text: { fr: "Très bien" },
      source: "facebook",
    });
  });
});

describe("prestations", () => {
  it("retrouve la prestation par identifiant, pas par position", () => {
    // Des rendez-vous déjà pris référencent cet identifiant : un décalage
    // rattacherait une réservation à une autre prestation, avec une autre durée.
    const raw = siteComplet();
    appliquerSection(raw, "prestations", {
      "services.0.id": "barbe",
      "services.0.durationMin": "25",
      "services.0.price": "20",
    });
    const barbe = raw.services.find((s: { id: string }) => s.id === "barbe");
    expect(barbe).toMatchObject({ durationMin: 25, price: 20 });
    expect(raw.services.find((s: { id: string }) => s.id === "coupe")).toMatchObject({
      durationMin: 30,
    });
  });

  it("traduit un prix vide en « sur devis »", () => {
    const raw = siteComplet();
    appliquerSection(raw, "prestations", {
      "services.0.id": "coupe",
      "services.0.durationMin": "30",
      "services.0.price": "",
    });
    expect(raw.services[0].price).toBeNull();
  });

  it("retient « à partir de »", () => {
    const raw = siteComplet();
    appliquerSection(raw, "prestations", {
      "services.0.id": "coupe",
      "services.0.durationMin": "30",
      "services.0.price": "28",
      "services.0.priceFrom": "1",
    });
    expect(raw.services[0].priceFrom).toBe(true);
  });

  it("n'invente pas de prestation quand l'identifiant est inconnu", () => {
    const raw = siteComplet();
    const avant = raw.services.length;
    appliquerSection(raw, "prestations", {
      "services.5.id": "inexistante",
      "services.5.durationMin": "10",
    });
    expect(raw.services).toHaveLength(avant);
  });
});

describe("sections connues", () => {
  it("refuse un nom de section inventé", () => {
    expect(estSection("galerie")).toBe(true);
    expect(estSection("../../etc/passwd")).toBe(false);
  });
});
