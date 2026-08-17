/**
 * Création d'un client depuis la console.
 *
 * Le squelette produit ici a une contrainte que `pnpm new` n'a pas : il est
 * montré au commerçant dans la minute qui suit, sur le téléphone, pendant le
 * rendez-vous. Il doit donc paraître fini, sans rien affirmer de faux sur le
 * commerce.
 *
 * D'où deux règles opposées, tenues ensemble :
 *
 *  - **rien d'inventé.** Pas de prestation, pas de tarif, pas d'horaire tiré
 *    d'un salon moyen. Un prix inventé qui passe en ligne engage le commerçant
 *    sur un montant qu'il ne pratique pas, et personne ne s'en aperçoit avant
 *    qu'un client le lui réclame. Les sections sans données ne s'affichent pas :
 *    mieux vaut une section absente qu'une section fausse.
 *
 *  - **rien de vide non plus.** Ce que le commerçant vient de dire — son nom,
 *    son adresse, son téléphone — remplit le site immédiatement, et la
 *    photothèque arrive garnie de visuels abstraits utilisables tels quels.
 *
 * Le reste se remplit dans l'éditeur, devant lui, en lui posant les questions.
 * C'est le bon moment pour les poser.
 */

import { randomUUID } from "node:crypto";
import { SiteConfig, ThemeConfig } from "@bxl/schema";
import { composerTheme } from "@bxl/schema/presets";

/** Type de commerce proposé au formulaire, avec son libellé. */
export const TYPES_COMMERCE = {
  hair_salon: "Salon de coiffure",
  barbershop: "Barbier",
  beauty_salon: "Institut de beauté",
  other: "Autre commerce",
} as const;

export type TypeCommerce = keyof typeof TYPES_COMMERCE;

/**
 * Nom du commerce → identifiant technique.
 *
 * L'identifiant sert de nom de dossier, de sous-domaine et de clé en base : il
 * ne peut donc contenir ni accent, ni espace, ni apostrophe. La translittération
 * passe par la décomposition Unicode — « Émilie » donne « emilie », pas « milie ».
 */
export function identifiant(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Le ß et le œ ne se décomposent pas : ils ont leur propre point de code.
    .replace(/ß/gi, "ss")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export interface DemandeNouveauClient {
  slug: string;
  nom: string;
  type: TypeCommerce;
  /** Domaine complet du site, généralement `<slug>.<domaine de service>`. */
  domaine: string;
  telephone: string;
  /** Reçoit les demandes de contact et les avis de rendez-vous. */
  email: string;
  rue: string;
  codePostal: string;
  ville: string;
  plan: "essentiel" | "pro" | "signature";
  langues: string[];
  style: string;
  palette: string;
}

export interface Squelette {
  site: Record<string, unknown>;
  theme: ThemeConfig;
  tenantId: string;
}

/**
 * Horaires laissés vides.
 *
 * Tentation permanente : préremplir « 9h-18h du mardi au samedi », qui est
 * juste pour beaucoup de salons. Mais l'agenda lit ces horaires, et un salon
 * fermé le mercredi dont le site accepte les rendez-vous du mercredi produit
 * un client devant une porte close.
 *
 * Encore fallait-il que le site sache le dire. Il listait les sept jours suivis
 * de « Fermé », ce qui se lit comme un commerce qui a mis la clé sous la porte
 * — pire que pas d'horaires du tout. `Info.astro` affiche désormais une seule
 * ligne, « nous contacter pour les horaires », quand aucun jour n'est
 * renseigné.
 */
const HORAIRES_VIDES = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

export function squelette(demande: DemandeNouveauClient): Squelette {
  const langueDefaut = demande.langues[0] ?? "fr";

  const site = {
    slug: demande.slug,
    /*
     * `preview`, jamais `live` : le site part en ligne à son adresse pour être
     * montré, mais refusé à Google. Passer en « live » est une décision qui se
     * prend une fois le contenu vérifié — voir le champ `status` du schéma.
     */
    status: "preview",
    plan: demande.plan,
    demo: false,
    tenantId: undefined as string | undefined,
    domain: demande.domaine,
    aliases: [],
    languages: { default: langueDefaut, available: demande.langues },
    business: {
      name: demande.nom,
      type: demande.type,
      // La description est obligatoire au schéma et s'affiche en toutes
      // lettres : la laisser à compléter la rend impossible à oublier.
      description: { [langueDefaut]: "À compléter" },
      address: {
        street: demande.rue,
        postalCode: demande.codePostal,
        city: demande.ville,
        country: "BE",
      },
      phone: demande.telephone,
      email: demande.email,
      social: {},
    },
    hero: {
      image: "hero.jpg",
      // Le nom du commerce n'est pas une invention : c'est un titre exact, et
      // il suffit à ce que la page d'accueil ne s'ouvre pas sur « À compléter ».
      headline: { [langueDefaut]: demande.nom },
    },
    hours: HORAIRES_VIDES,
    closures: [],
    // Vides et assumés : voir l'en-tête du fichier.
    services: [],
    team: [],
    gallery: [],
    steps: [],
    reviews: [],
    booking: { mode: "none" },
    seo: {},
    contact: {},
  };

  const tenantId = randomUUID();
  site.tenantId = tenantId;

  return { site, theme: composerTheme(demande.style, demande.palette), tenantId };
}

/** Valide le squelette avec le même schéma que le build. */
export function valider(s: Squelette): { ok: true } | { ok: false; erreurs: string[] } {
  const site = SiteConfig.safeParse(s.site);
  if (!site.success) {
    return {
      ok: false,
      erreurs: site.error.issues.map(
        (i) => `${i.path.join(".") || "(racine)"} — ${i.message}`,
      ),
    };
  }
  const theme = ThemeConfig.safeParse(s.theme);
  if (!theme.success) {
    return {
      ok: false,
      erreurs: theme.error.issues.map(
        (i) => `thème : ${i.path.join(".") || "(racine)"} — ${i.message}`,
      ),
    };
  }
  return { ok: true };
}

/**
 * Ce qu'il reste à faire avant de passer le site en ligne pour de bon.
 *
 * Affiché en permanence tant que le site est en `preview`. Sans cette liste, un
 * site créé en clientèle reste indéfiniment dans cet état : il s'affiche, il
 * est joli, rien ne signale qu'il est invisible pour Google — et le commerçant
 * finit par demander pourquoi on ne le trouve pas.
 */
export function resteAFaire(site: SiteConfig): string[] {
  const manque: string[] = [];
  const langue = site.languages.default;
  const aCompleter = (t: Partial<Record<string, string>> | undefined) => {
    const texte = t?.[langue];
    return !texte || /à compléter/i.test(texte);
  };

  if (aCompleter(site.business.description)) manque.push("la présentation du commerce");
  if (aCompleter(site.hero.subline ?? site.business.tagline)) {
    manque.push("l'accroche sous le titre");
  }
  if (Object.values(site.hours).every((jour) => jour.length === 0)) {
    manque.push("les horaires d'ouverture");
  }
  if (site.services.length === 0) manque.push("les prestations et leurs tarifs");
  if (site.gallery.length === 0) manque.push("les photos du salon");
  if (!site.legal) manque.push("les mentions légales (obligatoires en Belgique)");
  return manque;
}
