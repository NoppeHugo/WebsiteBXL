import { describe, expect, it } from "vitest";
import { SiteConfig, ThemeConfig, t, formatPrice } from "./index.ts";
import { BookingRequestInput, ContactMessageInput, isAcceptableDate } from "./booking.ts";

/**
 * Le contrat de données protège trente sites d'un coup : une régression ici
 * laisserait passer un contenu cassé sur tous les clients au prochain build.
 */

function validSite(overrides: Record<string, unknown> = {}) {
  return {
    slug: "salon-test",
    plan: "pro",
    domain: "salon-test.be",
    languages: { default: "fr", available: ["fr", "nl"] },
    business: {
      name: "Salon Test",
      type: "hair_salon",
      description: { fr: "Un salon." },
      address: { street: "Rue X 1", postalCode: "1000", city: "Bruxelles" },
      phone: "+32 2 000 00 00",
    },
    hero: { image: "hero.jpg", headline: { fr: "Titre" } },
    hours: {
      monday: [],
      tuesday: [{ open: "09:00", close: "18:00" }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
    ...overrides,
  };
}

describe("SiteConfig", () => {
  it("accepte un client minimal et applique les valeurs par défaut", () => {
    const result = SiteConfig.parse(validSite());
    expect(result.status).toBe("draft");
    expect(result.demo).toBe(false);
    expect(result.booking.mode).toBe("none");
    expect(result.services).toEqual([]);
  });

  it("connaît l'état intermédiaire « preview »", () => {
    /*
     * Sans lui, un site créé en clientèle n'avait que deux issues : rester
     * invisible — donc rien à montrer au commerçant — ou passer « live », et
     * offrir à Google un brouillon signé du nom du salon.
     */
    expect(SiteConfig.parse(validSite({ status: "preview" })).status).toBe("preview");
    expect(SiteConfig.safeParse(validSite({ status: "en-ligne" })).success).toBe(false);
  });

  it("rend la durée facultative, sauf quand le site prend des rendez-vous", () => {
    /*
     * Un bouquet n'a pas de durée. Mais dès qu'un site réserve, c'est la durée
     * qui découpe les créneaux : sans elle, l'agenda proposerait des
     * rendez-vous qui se chevauchent tous, et cela ne se verrait qu'au premier
     * double-booking, chez le client.
     */
    const sansDuree = {
      id: "bouquet",
      name: { fr: "Bouquet" },
      price: 25,
    };

    expect(
      SiteConfig.safeParse(validSite({ services: [sansDuree] })).success,
    ).toBe(true);

    for (const mode of ["request", "live"] as const) {
      const r = SiteConfig.safeParse(
        validSite({ services: [sansDuree], booking: { mode }, tenantId: crypto.randomUUID() }),
      );
      expect(r.success, mode).toBe(false);
      if (!r.success) {
        expect(JSON.stringify(r.error.issues)).toContain("durée");
      }
    }
  });

  it("accepte les sections propres au fleuriste", () => {
    const r = SiteConfig.safeParse(
      validSite({
        occasions: [{ id: "mariage", title: { fr: "Mariage" }, price: 180 }],
        delivery: { zones: ["Ixelles"], cutoff: "14:00", fee: 7, freeFrom: 60 },
        mourning: { text: { fr: "Couronnes et gerbes." }, venues: ["Funérarium d'Ixelles"] },
        subscriptions: [
          { id: "hebdo", name: { fr: "Chaque semaine" }, rhythm: { fr: "Un bouquet par semaine" }, price: 32 },
        ],
      }),
    );
    expect(r.success ? "" : JSON.stringify(r.error.issues)).toBe("");
  });

  it("laisse ces sections vides pour les autres métiers", () => {
    // Vides, elles ne s'affichent pas : c'est ce qui permet à un salon de
    // coiffure et à un fleuriste de partager exactement le même template.
    const site = SiteConfig.parse(validSite());
    expect(site.occasions).toEqual([]);
    expect(site.subscriptions).toEqual([]);
    expect(site.delivery).toBeUndefined();
    expect(site.mourning).toBeUndefined();
  });

  it("refuse une langue par défaut absente des langues disponibles", () => {
    const result = SiteConfig.safeParse(
      validSite({ languages: { default: "en", available: ["fr", "nl"] } }),
    );
    expect(result.success).toBe(false);
  });

  it("refuse une heure de fermeture antérieure à l'ouverture", () => {
    const site = validSite();
    site.hours.tuesday = [{ open: "18:00", close: "09:00" }];
    expect(SiteConfig.safeParse(site).success).toBe(false);
  });

  it("refuse deux prestations portant le même identifiant", () => {
    const service = {
      id: "coupe",
      name: { fr: "Coupe" },
      durationMin: 30,
      price: 30,
    };
    const result = SiteConfig.safeParse(
      validSite({ services: [service, { ...service }] }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain("double");
  });

  it("refuse un texte non traduit dans la langue par défaut", () => {
    // Le repli existe pour les langues secondaires, jamais pour la principale :
    // un site livré ne doit pas afficher de trou.
    const result = SiteConfig.safeParse(
      validSite({ hero: { image: "hero.jpg", headline: { nl: "Titel" } } }),
    );
    expect(result.success).toBe(false);
  });

  it("exige un tenantId dès que la réservation passe par notre API", () => {
    const withoutTenant = SiteConfig.safeParse(
      validSite({ booking: { mode: "request" } }),
    );
    expect(withoutTenant.success).toBe(false);

    const withTenant = SiteConfig.safeParse(
      validSite({
        booking: { mode: "request" },
        tenantId: "3f1b7c2e-9d4a-4f8b-8c1e-0a2b6d5e7f30",
      }),
    );
    expect(withTenant.success).toBe(true);
  });

  it("n'exige pas de tenantId pour une réservation externe", () => {
    const result = SiteConfig.safeParse(
      validSite({ booking: { mode: "external", url: "https://salonkee.be/x" } }),
    );
    expect(result.success).toBe(true);
  });
});

describe("ThemeConfig", () => {
  const palette = {
    bg: "#000000",
    surface: "#111111",
    text: "#ffffff",
    muted: "#888888",
    accent: "#0071e3",
    accentText: "#ffffff",
    border: "#222222",
  };

  it("refuse une couleur qui n'est pas hexadécimale sur six chiffres", () => {
    const result = ThemeConfig.safeParse({
      palette: { ...palette, accent: "blue" },
      fonts: { display: "serif", body: "sans-serif" },
      layout: {},
    });
    expect(result.success).toBe(false);
  });

  it("applique les effets par défaut quand ils ne sont pas déclarés", () => {
    const theme = ThemeConfig.parse({
      palette,
      fonts: { display: "serif", body: "sans-serif" },
      layout: {},
    });
    expect(theme.effects.glass).toBe(false);
    expect(theme.effects.blur).toBe(20);
    expect(theme.radius).toBe("none");
  });
});

describe("t", () => {
  it("retombe sur la langue par défaut quand la traduction manque", () => {
    expect(t({ fr: "Bonjour" }, "nl", "fr")).toBe("Bonjour");
  });

  it("préfère la langue demandée quand elle existe", () => {
    expect(t({ fr: "Bonjour", nl: "Hallo" }, "nl", "fr")).toBe("Hallo");
  });

  it("renvoie une chaîne vide plutôt que de planter", () => {
    expect(t(undefined, "fr", "fr")).toBe("");
  });
});

describe("formatPrice", () => {
  it("affiche « sur devis » quand le prix est absent", () => {
    expect(formatPrice({ price: null, priceFrom: false }, "fr")).toBe("sur devis");
    expect(formatPrice({ price: null, priceFrom: false }, "nl")).toBe("op aanvraag");
  });

  it("préfixe les prix à partir de", () => {
    expect(formatPrice({ price: 30, priceFrom: true }, "fr")).toMatch(/^dès /);
    expect(formatPrice({ price: 30, priceFrom: true }, "en")).toMatch(/^from /);
  });
});

describe("BookingRequestInput", () => {
  const valid = {
    tenantId: "3f1b7c2e-9d4a-4f8b-8c1e-0a2b6d5e7f30",
    serviceId: "coupe-homme",
    preferredDate: "2027-01-15",
    preferredPeriod: "morning",
    name: "Jean Dupont",
    email: "jean@exemple.be",
    consent: "on",
  };

  it("accepte une demande complète", () => {
    expect(BookingRequestInput.safeParse(valid).success).toBe(true);
  });

  it("refuse une demande sans consentement", () => {
    const { consent, ...withoutConsent } = valid;
    expect(BookingRequestInput.safeParse(withoutConsent).success).toBe(false);
  });

  it("laisse passer le piège à robots pour que la route décide", () => {
    // Le rejeter ici renverrait une erreur de validation au robot et rendrait
    // inatteignable la réponse en faux succès.
    const result = BookingRequestInput.safeParse({ ...valid, _company: "SpamCorp" });
    expect(result.success).toBe(true);
  });

  it("refuse une adresse électronique invalide", () => {
    expect(
      BookingRequestInput.safeParse({ ...valid, email: "pas-une-adresse" }).success,
    ).toBe(false);
  });

  it("refuse une URL de retour qui n'en est pas une", () => {
    expect(
      BookingRequestInput.safeParse({ ...valid, redirectTo: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
});

describe("ContactMessageInput", () => {
  it("refuse un message vide", () => {
    const result = ContactMessageInput.safeParse({
      tenantId: "3f1b7c2e-9d4a-4f8b-8c1e-0a2b6d5e7f30",
      name: "Jean Dupont",
      email: "jean@exemple.be",
      message: "",
      consent: "on",
    });
    expect(result.success).toBe(false);
  });
});

describe("isAcceptableDate", () => {
  const today = new Date("2026-08-15T09:00:00Z");

  it("accepte aujourd'hui", () => {
    expect(isAcceptableDate("2026-08-15", today)).toBe(true);
  });

  it("refuse hier", () => {
    expect(isAcceptableDate("2026-08-14", today)).toBe(false);
  });

  it("accepte une date dans onze mois", () => {
    expect(isAcceptableDate("2027-07-15", today)).toBe(true);
  });

  it("refuse une date au-delà d'un an", () => {
    expect(isAcceptableDate("2027-09-15", today)).toBe(false);
  });

  it("refuse une date qui n'existe pas", () => {
    expect(isAcceptableDate("2026-02-31", today)).toBe(false);
  });
});
