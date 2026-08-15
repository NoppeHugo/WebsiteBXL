import { z } from "zod";

/**
 * Contrat de données du projet.
 *
 * Ce fichier est la source de vérité du format d'un client. Le template Astro,
 * les scripts de build, la future console d'administration et l'API de
 * réservation valident tous leurs données ici. Toute évolution du format se
 * fait dans ce fichier d'abord.
 */

export const LANGUAGES = ["fr", "nl", "en"] as const;
export const Language = z.enum(LANGUAGES);
export type Language = z.infer<typeof Language>;

/**
 * Un texte traduit. Seule la langue par défaut du client est obligatoire —
 * la résolution retombe dessus quand une traduction manque (voir `t()`).
 */
export const LocalizedText = z.record(Language, z.string().min(1));
export type LocalizedText = z.infer<typeof LocalizedText>;

const Slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug en minuscules, tirets uniquement");

const Domain = z
  .string()
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "nom de domaine invalide")
  .transform((d) => d.toLowerCase());

const Time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "heure au format HH:MM");

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date au format YYYY-MM-DD");

/* -------------------------------------------------------------------------- */
/* Horaires                                                                   */
/* -------------------------------------------------------------------------- */

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Un créneau d'ouverture. Une journée peut en compter plusieurs (pause midi). */
export const TimeRange = z
  .object({ open: Time, close: Time })
  .refine((r) => r.open < r.close, {
    message: "l'heure de fermeture doit suivre l'heure d'ouverture",
  });

/** Un jour sans créneau est un jour de fermeture. */
export const OpeningHours = z.object(
  Object.fromEntries(
    WEEKDAYS.map((d) => [d, z.array(TimeRange).default([])]),
  ) as Record<Weekday, z.ZodDefault<z.ZodArray<typeof TimeRange>>>,
);
export type OpeningHours = z.infer<typeof OpeningHours>;

/** Fermeture exceptionnelle : congés, jours fériés. Bornes incluses. */
export const Closure = z
  .object({
    from: IsoDate,
    to: IsoDate,
    reason: LocalizedText.optional(),
  })
  .refine((c) => c.from <= c.to, {
    message: "la date de fin doit suivre la date de début",
  });

/* -------------------------------------------------------------------------- */
/* Contenu                                                                    */
/* -------------------------------------------------------------------------- */

export const Photo = z.object({
  /** Chemin relatif au dossier `media/` du client. */
  src: z.string().min(1),
  alt: LocalizedText,
});

export const Service = z.object({
  id: Slug,
  name: LocalizedText,
  description: LocalizedText.optional(),
  /** En minutes. Utilisé par la réservation pour calculer les créneaux. */
  durationMin: z.number().int().positive().max(600),
  /** En euros. `null` = « sur devis ». */
  price: z.number().nonnegative().nullable(),
  /** Affiche « à partir de » devant le prix. */
  priceFrom: z.boolean().default(false),
  category: LocalizedText.optional(),
});

export const TeamMember = z.object({
  name: z.string().min(1),
  role: LocalizedText.optional(),
  photo: z.string().optional(),
});

export const Review = z.object({
  author: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: LocalizedText,
  source: z.enum(["google", "facebook", "direct"]).default("google"),
});

/* -------------------------------------------------------------------------- */
/* Réservation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Les modes suivent le phasage décrit dans le README :
 *  - `none`     : pas de réservation (palier Essentiel).
 *  - `external` : lien vers un prestataire existant (Salonkee, Treatwell…).
 *  - `request`  : demande de rendez-vous, confirmation manuelle par le salon (v1).
 *  - `live`     : agenda temps réel, confirmation automatique (v2).
 */
export const Booking = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("none") }),
    z.object({ mode: z.literal("external"), url: z.string().url() }),
    z.object({ mode: z.literal("request"), tenantId: z.string().uuid() }),
    z.object({ mode: z.literal("live"), tenantId: z.string().uuid() }),
  ])
  .default({ mode: "none" });

/* -------------------------------------------------------------------------- */
/* site.json                                                                  */
/* -------------------------------------------------------------------------- */

export const SiteConfig = z
  .object({
    slug: Slug,

    /**
     * `draft`     : en préparation, non déployé.
     * `live`      : en ligne.
     * `suspended` : impayé — déploie la page « site temporairement
     *               indisponible » au lieu du site (cf. README §3.11).
     */
    status: z.enum(["draft", "live", "suspended"]).default("draft"),
    plan: z.enum(["essentiel", "pro", "signature"]),

    /** Signale un site de démonstration : `noindex` et bandeau de démo. */
    demo: z.boolean().default(false),

    domain: Domain,
    /** Domaines additionnels servis par Caddy (www, ancien nom…). */
    aliases: z.array(Domain).default([]),

    languages: z
      .object({
        default: Language,
        available: z.array(Language).min(1),
      })
      .refine((l) => l.available.includes(l.default), {
        message: "la langue par défaut doit figurer dans les langues disponibles",
      }),

    business: z.object({
      name: z.string().min(1),
      type: z.enum([
        "hair_salon",
        "barbershop",
        "beauty_salon",
        "bakery",
        "florist",
        "other",
      ]),
      tagline: LocalizedText.optional(),
      description: LocalizedText,
      address: z.object({
        street: z.string().min(1),
        postalCode: z.string().min(1),
        city: z.string().min(1),
        country: z.string().length(2).default("BE"),
      }),
      geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
      phone: z.string().min(1),
      email: z.string().email().optional(),
      social: z
        .object({
          instagram: z.string().url().optional(),
          facebook: z.string().url().optional(),
          tiktok: z.string().url().optional(),
        })
        .default({}),
      /** Alimente la fiche Google Business, argument de vente central. */
      googleMapsUrl: z.string().url().optional(),
      googlePlaceId: z.string().optional(),
    }),

    hero: z.object({
      image: z.string().min(1),
      headline: LocalizedText,
      subline: LocalizedText.optional(),
    }),

    hours: OpeningHours,
    hoursNote: LocalizedText.optional(),
    closures: z.array(Closure).default([]),

    services: z.array(Service).default([]),
    team: z.array(TeamMember).default([]),
    gallery: z.array(Photo).default([]),
    reviews: z.array(Review).default([]),

    booking: Booking,

    seo: z
      .object({
        title: LocalizedText.optional(),
        description: LocalizedText.optional(),
      })
      .default({}),

    /**
     * Mentions légales. Obligatoires en Belgique pour tout site commercial
     * (livre XII du Code de droit économique) : identité de l'entreprise,
     * numéro d'entreprise, TVA et coordonnées de contact doivent être
     * accessibles facilement et en permanence.
     *
     * Facultatif dans le schéma pour ne pas bloquer un brouillon, mais
     * `pnpm check` en fait une erreur dès qu'un site passe en statut « live ».
     */
    legal: z
      .object({
        /** Dénomination sociale, ou nom et prénom pour un indépendant. */
        companyName: z.string().min(1),
        /** SRL, SA, ASBL, personne physique… */
        legalForm: z.string().optional(),
        /** Numéro d'entreprise BCE, format 0123.456.789. */
        registrationNumber: z.string().optional(),
        /** Numéro de TVA, format BE0123.456.789. */
        vatNumber: z.string().optional(),
        /** Siège social, s'il diffère de l'adresse du commerce. */
        registeredAddress: z.string().optional(),
        /** Éditeur responsable de la publication. */
        publisher: z.string().optional(),
      })
      .optional(),

    contact: z
      .object({
        /**
         * Adresse de réception du formulaire de contact. Sans elle, le
         * formulaire n'est pas affiché et seuls le téléphone et l'e-mail
         * restent proposés — mieux vaut aucun formulaire qu'un formulaire
         * qui perd les messages du client.
         */
        formEndpoint: z.string().url().optional(),
      })
      .default({}),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    for (const [i, s] of cfg.services.entries()) {
      if (ids.has(s.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["services", i, "id"],
          message: `identifiant de service en double : ${s.id}`,
        });
      }
      ids.add(s.id);
    }

    // La langue par défaut doit être renseignée partout, sinon le repli
    // silencieux masquerait un texte manquant sur le site livré.
    const lang = cfg.languages.default;
    const required: Array<[LocalizedText | undefined, string]> = [
      [cfg.business.description, "business.description"],
      [cfg.hero.headline, "hero.headline"],
    ];
    for (const [text, path] of required) {
      if (text && !text[lang]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: path.split("."),
          message: `traduction manquante pour la langue par défaut (${lang})`,
        });
      }
    }
  });

export type SiteConfig = z.infer<typeof SiteConfig>;

/* -------------------------------------------------------------------------- */
/* theme.json                                                                 */
/* -------------------------------------------------------------------------- */

const Color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "couleur hexadécimale sur 6 chiffres, ex. #101010");

/**
 * Le thème est de la donnée, pas du code : c'est lui qui permet d'avoir des
 * sites qui ne se ressemblent pas sans dupliquer la base de code (README §3.3).
 */
export const ThemeConfig = z.object({
  palette: z.object({
    bg: Color,
    surface: Color,
    text: Color,
    muted: Color,
    accent: Color,
    accentText: Color,
    border: Color,
  }),
  /**
   * Piles de polices système, ou polices auto-hébergées déposées dans
   * `apps/template/public/fonts`. Jamais de CDN Google Fonts : le transfert
   * d'IP vers un tiers hors UE a déjà valu des condamnations en Europe.
   *
   * Cas particulier des polices Apple : SF Pro ne peut pas être hébergée sur
   * un site client, sa licence la réservant aux plateformes Apple. La pile
   * système (`-apple-system`) la fournit nativement sur iPhone et Mac, avec un
   * repli sur Segoe UI ou Roboto ailleurs — c'est la seule façon légale de
   * l'obtenir. Pour un rendu identique sur toutes les plateformes, héberger
   * Inter, sous licence libre et très proche de SF.
   */
  fonts: z.object({
    display: z.string().min(1),
    body: z.string().min(1),
    displayWeight: z.number().int().min(100).max(900).default(400),
    displayTracking: z.string().default("0"),
    displayTransform: z.enum(["none", "uppercase"]).default("none"),
    /** Casse et interlettrage des éléments d'interface : boutons, navigation. */
    uiTransform: z.enum(["none", "uppercase"]).default("uppercase"),
    uiTracking: z.string().default("0.12em"),
  }),
  layout: z.object({
    hero: z.enum(["fullbleed", "split", "minimal"]).default("fullbleed"),
    /** Texte du hero aligné à gauche, ou centré comme sur les pages Apple. */
    heroAlign: z.enum(["start", "center"]).default("start"),
    gallery: z.enum(["grid", "mosaic", "strip"]).default("grid"),
    nav: z.enum(["overlay", "solid"]).default("overlay"),
  }),
  radius: z.enum(["none", "soft", "round"]).default("none"),
  /** Léger grain photographique sur les fonds sombres. */
  grain: z.boolean().default(false),

  /**
   * Effets de matière. `glass` produit les surfaces translucides floutées
   * typiques des interfaces Apple : navigation, cartes et bandeaux laissent
   * transparaître la photo qui défile derrière.
   *
   * Le flou est coûteux à l'affichage sur les téléphones d'entrée de gamme :
   * il reste réservé à quelques surfaces, jamais appliqué à des dizaines
   * d'éléments simultanés.
   */
  effects: z
    .object({
      glass: z.boolean().default(false),
      blur: z.number().int().min(0).max(60).default(20),
      /** Apparition en fondu des sections au défilement. */
      reveal: z.boolean().default(false),
    })
    .default({}),
});

export type ThemeConfig = z.infer<typeof ThemeConfig>;

/* -------------------------------------------------------------------------- */
/* Utilitaires                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Résout un texte traduit, avec repli sur la langue par défaut du client.
 * Le repli est volontaire : un site bilingue partiellement traduit doit rester
 * lisible plutôt que d'afficher des trous.
 */
export function t(
  text: LocalizedText | undefined,
  lang: Language,
  fallback: Language,
): string {
  if (!text) return "";
  return text[lang] ?? text[fallback] ?? "";
}

/** Formate un prix en euros à la belge : « 32 € », « à partir de 45 € ». */
export function formatPrice(
  service: Pick<Service, "price" | "priceFrom">,
  lang: Language,
): string {
  if (service.price === null) {
    return { fr: "sur devis", nl: "op aanvraag", en: "on request" }[lang];
  }
  const amount = new Intl.NumberFormat(`${lang}-BE`, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: service.price % 1 === 0 ? 0 : 2,
  }).format(service.price);
  if (!service.priceFrom) return amount;
  return { fr: `dès ${amount}`, nl: `vanaf ${amount}`, en: `from ${amount}` }[
    lang
  ];
}
