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
  closures: [] as Array<{ from: string; to: string; reason?: Record<string, string> }>,
  // Les blocs propres au fleuriste. Le squelette les porte pour que les tests
  // décrivent le même objet que celui qu'un vrai site.json contient.
  occasions: [] as Array<Record<string, unknown>>,
  menu: [] as Array<Record<string, unknown>>,
  menuNote: undefined as Record<string, string> | undefined,
  courses: [] as Array<Record<string, unknown>>,
  subscriptions: [] as Array<Record<string, unknown>>,
  delivery: undefined as Record<string, unknown> | undefined,
  mourning: undefined as Record<string, unknown> | undefined,
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

describe("horaires", () => {
  it("lit les créneaux d'une journée", () => {
    const raw = siteComplet() as Record<string, any>;
    appliquerSection(raw, "horaires", { "hours.tuesday": "09:30-12:30, 13:30-18:00" });
    expect(raw.hours.tuesday).toEqual([
      { open: "09:30", close: "12:30" },
      { open: "13:30", close: "18:00" },
    ]);
  });

  it("ferme les journées absentes du formulaire", () => {
    // Une case vidée doit fermer la journée : la traiter comme « inchangée »
    // rendrait impossible de fermer un jour depuis la console.
    const raw = siteComplet() as Record<string, any>;
    appliquerSection(raw, "horaires", { "hours.tuesday": "09:00-18:00" });
    expect(raw.hours.wednesday).toEqual([]);
    expect(raw.hours.sunday).toEqual([]);
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
  /*
   * Le formulaire renvoie toujours la liste complète : chaque ligne porte son
   * nom, sa durée et son prix, et une ligne absente est une prestation
   * retirée. C'est la même règle que pour les horaires et la galerie.
   */
  const ligne = (i: number, champs: Record<string, string>) =>
    Object.fromEntries(Object.entries(champs).map(([k, v]) => [`services.${i}.${k}`, v]));

  it("retrouve la prestation par identifiant, pas par position", () => {
    // Des rendez-vous déjà pris référencent cet identifiant : un décalage
    // rattacherait une réservation à une autre prestation, avec une autre durée.
    const raw = siteComplet();
    appliquerSection(raw, "prestations", {
      ...ligne(0, { id: "barbe", "name.fr": "Barbe", durationMin: "25", price: "20" }),
      ...ligne(1, { id: "coupe", "name.fr": "Coupe", durationMin: "30", price: "28" }),
    });
    expect(raw.services.find((s: { id: string }) => s.id === "barbe")).toMatchObject({
      durationMin: 25,
      price: 20,
    });
    expect(raw.services.find((s: { id: string }) => s.id === "coupe")).toMatchObject({
      durationMin: 30,
    });
  });

  it("traduit un prix vide en « sur devis »", () => {
    const raw = siteComplet();
    appliquerSection(
      raw,
      "prestations",
      ligne(0, { id: "coupe", "name.fr": "Coupe", durationMin: "30", price: "" }),
    );
    expect(raw.services[0]!.price).toBeNull();
  });

  it("accepte la virgule décimale du clavier belge", () => {
    // « 28,50 » lu par Number() donne NaN, donc « sur devis » — un tarif qui
    // disparaît de la carte sans que personne ne s'en aperçoive.
    const raw = siteComplet();
    appliquerSection(
      raw,
      "prestations",
      ligne(0, { id: "coupe", "name.fr": "Coupe", durationMin: "30", price: "28,50" }),
    );
    expect(raw.services[0]!.price).toBe(28.5);
  });

  it("retient « à partir de »", () => {
    const raw = siteComplet();
    appliquerSection(
      raw,
      "prestations",
      ligne(0, {
        id: "coupe",
        "name.fr": "Coupe",
        durationMin: "30",
        price: "28",
        priceFrom: "1",
      }),
    );
    expect(raw.services[0]!.priceFrom).toBe(true);
  });

  it("ajoute une prestation dont l'identifiant est dérivé du nom", () => {
    const raw = siteComplet();
    appliquerSection(raw, "prestations", {
      ...ligne(0, { id: "coupe", "name.fr": "Coupe", durationMin: "30", price: "28" }),
      ...ligne(1, { id: "barbe", "name.fr": "Barbe", durationMin: "20", price: "" }),
      ...ligne(2, { id: "", "name.fr": "Coupe & barbe", durationMin: "45", price: "40" }),
    });
    expect(raw.services).toHaveLength(3);
    expect(raw.services[2]).toMatchObject({ id: "coupe-barbe", durationMin: 45, price: 40 });
  });

  it("ne donne jamais deux fois le même identifiant", () => {
    // Deux prestations homonymes existent : « Coupe » enfant et adulte. Le
    // second écraserait le premier si l'identifiant était le même, et les
    // rendez-vous de l'un basculeraient sur l'autre.
    const raw = siteComplet();
    appliquerSection(raw, "prestations", {
      ...ligne(0, { id: "", "name.fr": "Coupe", durationMin: "30", price: "28" }),
      ...ligne(1, { id: "", "name.fr": "Coupe", durationMin: "20", price: "18" }),
    });
    expect(raw.services.map((s: { id: string }) => s.id)).toEqual(["coupe-2", "coupe-3"]);
  });

  it("supprime une prestation absente du formulaire", () => {
    const raw = siteComplet();
    appliquerSection(
      raw,
      "prestations",
      ligne(0, { id: "coupe", "name.fr": "Coupe", durationMin: "30", price: "28" }),
    );
    expect(raw.services.map((s: { id: string }) => s.id)).toEqual(["coupe"]);
  });

  it("ignore une ligne sans nom", () => {
    // Une ligne ajoutée puis abandonnée. La garder ferait échouer la
    // construction du site pour tous les clients, pas seulement celui-ci.
    const raw = siteComplet();
    appliquerSection(raw, "prestations", {
      ...ligne(0, { id: "coupe", "name.fr": "Coupe", durationMin: "30", price: "28" }),
      ...ligne(1, { id: "", "name.fr": "", durationMin: "30", price: "" }),
    });
    expect(raw.services).toHaveLength(1);
  });

  it("ne reprend pas un identifiant inconnu tel quel", () => {
    /*
     * Le champ est caché : un identifiant qui ne correspond à rien vient d'une
     * requête forgée ou d'un envoi périmé. Le reprendre laisserait quelqu'un
     * d'autre choisir la clé à laquelle des rendez-vous se rattachent.
     */
    const raw = siteComplet();
    appliquerSection(
      raw,
      "prestations",
      ligne(0, { id: "inexistante", "name.fr": "Balayage", durationMin: "90", price: "85" }),
    );
    expect(raw.services).toHaveLength(1);
    expect(raw.services[0]!.id).toBe("balayage");
  });

  it("remplace une durée absurde par une valeur praticable", () => {
    // Une durée nulle fait proposer des créneaux qui se chevauchent tous.
    const raw = siteComplet();
    appliquerSection(
      raw,
      "prestations",
      ligne(0, { id: "coupe", "name.fr": "Coupe", durationMin: "0", price: "28" }),
    );
    expect(raw.services[0]!.durationMin).toBe(30);
  });
});

describe("sections connues", () => {
  it("refuse un nom de section inventé", () => {
    expect(estSection("galerie")).toBe(true);
    expect(estSection("../../etc/passwd")).toBe(false);
  });
});

describe("déroulé", () => {
  it("reconstruit les étapes dans l'ordre, avec leur photo", () => {
    const raw = siteComplet() as Record<string, any>;
    appliquerSection(raw, "deroule", {
      "steps.0.title.fr": "On fait le point",
      "steps.0.text.fr": "Deux minutes assis.",
      "steps.0.photo": "a.jpg",
      "steps.1.title.fr": "La coupe",
      "steps.1.title.nl": "De coupe",
      "steps.1.photo": "b.jpg",
    });
    expect(raw.steps).toEqual([
      { title: { fr: "On fait le point" }, text: { fr: "Deux minutes assis." }, photo: "a.jpg" },
      { title: { fr: "La coupe", nl: "De coupe" }, photo: "b.jpg" },
    ]);
  });

  it("écarte une étape sans photo ou sans titre", () => {
    // Une ligne ajoutée puis abandonnée ferait échouer la construction du
    // site : une étape sans fichier n'a rien à montrer.
    const raw = siteComplet() as Record<string, any>;
    appliquerSection(raw, "deroule", {
      "steps.0.title.fr": "La coupe",
      "steps.0.photo": "a.jpg",
      "steps.1.title.fr": "Sans photo",
      "steps.1.photo": "",
      "steps.2.title.fr": "",
      "steps.2.photo": "c.jpg",
    });
    expect(raw.steps).toHaveLength(1);
  });

  it("accepte qu'on retire toutes les étapes", () => {
    // La section disparaît alors du site, plutôt que d'afficher un titre seul.
    const raw = siteComplet() as Record<string, any>;
    raw.steps = [{ title: { fr: "x" }, photo: "a.jpg" }];
    appliquerSection(raw, "deroule", {});
    expect(raw.steps).toEqual([]);
  });
});

describe("fermetures", () => {
  it("enregistre une période, triée par date", () => {
    const raw = siteComplet();
    appliquerSection(raw, "fermetures", {
      "closures.0.from": "2026-12-24",
      "closures.0.to": "2027-01-02",
      "closures.1.from": "2026-08-01",
      "closures.1.to": "2026-08-15",
    });
    expect(raw.closures.map((f) => f.from)).toEqual([
      "2026-08-01",
      "2026-12-24",
    ]);
  });

  it("comprend une fermeture d'un seul jour sans date de fin", () => {
    // Saisir deux fois la même date pour fermer un mardi est une demande
    // absurde à faire à quelqu'un qui vient d'apprendre qu'il est malade.
    const raw = siteComplet();
    appliquerSection(raw, "fermetures", {
      "closures.0.from": "2026-09-03",
      "closures.0.to": "",
    });
    expect(raw.closures).toEqual([{ from: "2026-09-03", to: "2026-09-03" }]);
  });

  it("garde le motif quand il est renseigné, et rien sinon", () => {
    const raw = siteComplet();
    appliquerSection(raw, "fermetures", {
      "closures.0.from": "2026-07-01",
      "closures.0.to": "2026-07-21",
      "closures.0.reason.fr": "Congés annuels",
      "closures.1.from": "2026-09-03",
      "closures.1.to": "2026-09-03",
      "closures.1.reason.fr": "",
    });
    expect(raw.closures[0]).toMatchObject({ reason: { fr: "Congés annuels" } });
    expect(raw.closures[1]).not.toHaveProperty("reason");
  });

  it("ignore une ligne sans date de début", () => {
    // Le formulaire propose toujours une ligne vierge : envoyée telle quelle,
    // elle produirait une fermeture du 1er janvier 1970.
    const raw = siteComplet();
    appliquerSection(raw, "fermetures", {
      "closures.0.from": "2026-09-03",
      "closures.0.to": "2026-09-03",
      "closures.1.from": "",
      "closures.1.to": "",
    });
    expect(raw.closures).toHaveLength(1);
  });

  it("supprime toutes les fermetures quand le formulaire n'en renvoie aucune", () => {
    /*
     * C'est ainsi que « Rouvrir ces dates » fonctionne : le formulaire renvoie
     * la liste sans la ligne concernée. Une liste vide doit donc bien vider,
     * sinon rouvrir la dernière fermeture serait impossible.
     */
    const raw = siteComplet();
    raw.closures = [{ from: "2026-09-03", to: "2026-09-03" }];
    appliquerSection(raw, "fermetures", {});
    expect(raw.closures).toEqual([]);
  });
});

describe("occasions", () => {
  const ligne = (i: number, champs: Record<string, string>) =>
    Object.fromEntries(Object.entries(champs).map(([k, v]) => [`occasions.${i}.${k}`, v]));

  it("crée une occasion avec un identifiant dérivé du titre", () => {
    const raw = siteComplet();
    appliquerSection(raw, "occasions", ligne(0, { id: "", "title.fr": "Mariage", price: "180" }));
    expect(raw.occasions).toHaveLength(1);
    expect(raw.occasions[0]).toMatchObject({ id: "mariage", price: 180 });
  });

  it("accepte la virgule décimale et traduit un prix vide en « sur devis »", () => {
    const raw = siteComplet();
    appliquerSection(raw, "occasions", {
      ...ligne(0, { id: "", "title.fr": "Naissance", price: "35,50" }),
      ...ligne(1, { id: "", "title.fr": "Deuil", price: "" }),
    });
    expect(raw.occasions[0]!.price).toBe(35.5);
    expect(raw.occasions[1]!.price).toBeNull();
  });

  it("ignore une ligne sans titre", () => {
    const raw = siteComplet();
    appliquerSection(raw, "occasions", {
      ...ligne(0, { id: "", "title.fr": "Mariage" }),
      ...ligne(1, { id: "", "title.fr": "", price: "50" }),
    });
    expect(raw.occasions).toHaveLength(1);
  });
});

describe("livraison", () => {
  it("découpe les communes sur les virgules et les retours à la ligne", () => {
    const raw = siteComplet();
    appliquerSection(raw, "livraison", {
      "delivery.zones": "Ixelles, Saint-Gilles\nUccle ,, Forest",
      "delivery.cutoff": "14:00",
      "delivery.fee": "7",
    });
    expect(raw.delivery!.zones).toEqual(["Ixelles", "Saint-Gilles", "Uccle", "Forest"]);
    expect(raw.delivery).toMatchObject({ cutoff: "14:00", fee: 7 });
  });

  it("retire la section quand plus aucune commune n'est desservie", () => {
    /*
     * C'est le seul moyen simple, pour un fleuriste qui cesse de livrer, de
     * faire disparaître l'encadré. Le garder vide annoncerait une livraison
     * qui n'existe plus.
     */
    const raw = siteComplet();
    raw.delivery = { zones: ["Ixelles"], fee: 7 };
    appliquerSection(raw, "livraison", { "delivery.zones": "  , \n " });
    expect(raw.delivery).toBeUndefined();
  });

  it("annonce la livraison offerte quand les frais sont vides", () => {
    const raw = siteComplet();
    appliquerSection(raw, "livraison", { "delivery.zones": "Uccle", "delivery.fee": "" });
    expect(raw.delivery!.fee).toBeNull();
  });
});

describe("deuil", () => {
  it("retire la section quand le texte est vidé", () => {
    const raw = siteComplet();
    raw.mourning = { text: { fr: "Nous préparons…" }, venues: [] };
    appliquerSection(raw, "deuil", { "mourning.text.fr": "" });
    expect(raw.mourning).toBeUndefined();
  });

  it("garde les funérariums, qui sont ce que la famille vérifie", () => {
    const raw = siteComplet();
    appliquerSection(raw, "deuil", {
      "mourning.text.fr": "Couronnes et gerbes, livrées sur place.",
      "mourning.venues": "Funérarium d'Ixelles, Crématorium d'Uccle",
      "mourning.phone": "+32 2 538 41 12",
    });
    expect(raw.mourning!.venues).toEqual(["Funérarium d'Ixelles", "Crématorium d'Uccle"]);
    expect(raw.mourning!.phone).toBe("+32 2 538 41 12");
  });
});

describe("abonnements", () => {
  it("reprend le nom comme rythme quand celui-ci est laissé vide", () => {
    /*
     * Le rythme est obligatoire au schéma. Vide, l'enregistrement échouerait
     * avec un message technique — alors que le nom de la formule dit déjà le
     * rythme dans neuf cas sur dix.
     */
    const raw = siteComplet();
    appliquerSection(raw, "abonnements", {
      "subscriptions.0.id": "",
      "subscriptions.0.name.fr": "Chaque semaine",
      "subscriptions.0.rhythm.fr": "",
      "subscriptions.0.price": "32",
    });
    expect(raw.subscriptions[0]).toMatchObject({
      id: "chaque-semaine",
      rhythm: { fr: "Chaque semaine" },
      price: 32,
    });
  });
});

describe("carte", () => {
  const plat = (i: number, champs: Record<string, string>) =>
    Object.fromEntries(Object.entries(champs).map(([k, v]) => [`carte.${i}.${k}`, v]));

  it("range les plats en groupes, dans l'ordre de leur première apparition", () => {
    const raw = siteComplet();
    appliquerSection(raw, "carte", {
      ...plat(0, { "group.fr": "Entrées", "name.fr": "Croquettes", price: "12" }),
      ...plat(1, { "group.fr": "Plats", "name.fr": "Carbonnades", price: "22,50" }),
      ...plat(2, { "group.fr": "Entrées", "name.fr": "Soupe", price: "" }),
    });

    const menu = raw.menu as Array<Record<string, unknown>>;
    expect(menu.map((g) => g.id)).toEqual(["entrees", "plats"]);
    expect((menu[0]!.items as unknown[]).length).toBe(2);
    // Prix vide = « selon arrivage », pas gratuit ; virgule décimale acceptée.
    expect((menu[1]!.items as Array<Record<string, unknown>>)[0]!.price).toBe(22.5);
    expect((menu[0]!.items as Array<Record<string, unknown>>)[1]!.price).toBeNull();
  });

  it("reprend le groupe de la ligne précédente quand il est laissé vide", () => {
    /*
     * On recopie une carte de haut en bas. Retaper « Entrées » sur chaque
     * ligne est la corvée qui fait renoncer à tenir sa carte à jour — c'est-
     * à-dire à l'argument de vente du site.
     */
    const raw = siteComplet();
    appliquerSection(raw, "carte", {
      ...plat(0, { "group.fr": "Desserts", "name.fr": "Dame blanche", price: "9" }),
      ...plat(1, { "group.fr": "", "name.fr": "Tarte du jour", price: "7" }),
    });

    const menu = raw.menu as Array<Record<string, unknown>>;
    expect(menu).toHaveLength(1);
    expect((menu[0]!.items as unknown[]).length).toBe(2);
  });

  it("garde la note d'un groupe que le formulaire n'expose pas", () => {
    // Le formulaire ne montre pas la note du groupe. La régénérer à partir du
    // seul titre l'effacerait sans que rien ne le signale.
    const raw = siteComplet();
    raw.menu = [
      {
        id: "midi",
        title: { fr: "Formule du midi" },
        note: { fr: "En semaine, de 12 h à 14 h" },
        items: [],
      },
    ];
    appliquerSection(raw, "carte", plat(0, { "group.fr": "Formule du midi", "name.fr": "Plat + café", price: "17" }));

    const menu = raw.menu as Array<Record<string, unknown>>;
    expect(menu[0]!.note).toEqual({ fr: "En semaine, de 12 h à 14 h" });
    expect(menu[0]!.id).toBe("midi");
  });

  it("retient les régimes cochés et ignore une ligne sans nom", () => {
    const raw = siteComplet();
    appliquerSection(raw, "carte", {
      ...plat(0, { "group.fr": "Plats", "name.fr": "Stoemp", "tags.vegetarien": "on", "tags.maison": "on" }),
      ...plat(1, { "group.fr": "Plats", "name.fr": "" }),
    });

    const items = (raw.menu as Array<Record<string, unknown>>)[0]!.items as Array<
      Record<string, unknown>
    >;
    expect(items).toHaveLength(1);
    expect(items[0]!.tags).toEqual(["vegetarien", "maison"]);
  });

  it("enregistre le mot au-dessus de la carte, et le retire quand il est vidé", () => {
    const raw = siteComplet();
    appliquerSection(raw, "carte", {
      "menuNote.fr": "La carte change chaque semaine",
      ...plat(0, { "group.fr": "Plats", "name.fr": "Vol-au-vent", price: "21" }),
    });
    expect(raw.menuNote).toEqual({ fr: "La carte change chaque semaine" });

    appliquerSection(raw, "carte", plat(0, { "group.fr": "Plats", "name.fr": "Vol-au-vent" }));
    expect(raw.menuNote).toBeUndefined();
  });
});

describe("planning", () => {
  const cours = (i: number, champs: Record<string, string>) =>
    Object.fromEntries(Object.entries(champs).map(([k, v]) => [`courses.${i}.${k}`, v]));

  it("crée un cours avec un identifiant dérivé de son nom", () => {
    const raw = siteComplet();
    appliquerSection(raw, "planning", {
      ...cours(0, {
        id: "",
        "name.fr": "Yoga doux",
        day: "tuesday",
        start: "19:00",
        end: "20:00",
        coach: "Inès",
        capacity: "14",
      }),
    });
    expect(raw.courses).toHaveLength(1);
    expect(raw.courses[0]).toMatchObject({
      id: "yoga-doux",
      day: "tuesday",
      start: "19:00",
      end: "20:00",
      coach: "Inès",
      capacity: 14,
    });
  });

  it("rattrape une fin qui précède le début plutôt que d'échouer", () => {
    /*
     * Le schéma refuse un cours qui finit avant de commencer, et le message
     * qui en sort ne veut rien dire pour un gérant de salle. Une heure de plus
     * garde le cours visible et se corrige d'un clic.
     */
    const raw = siteComplet();
    appliquerSection(raw, "planning", cours(0, { id: "", "name.fr": "Pilates", start: "18:30", end: "17:00" }));
    expect(raw.courses[0]).toMatchObject({ start: "18:30", end: "19:30" });
  });

  it("refuse un jour inventé et ignore une ligne sans nom", () => {
    const raw = siteComplet();
    appliquerSection(raw, "planning", {
      ...cours(0, { id: "", "name.fr": "Renfo", day: "octidi" }),
      ...cours(1, { id: "", "name.fr": "" }),
    });
    expect(raw.courses).toHaveLength(1);
    expect(raw.courses[0]!.day).toBe("monday");
  });
});
