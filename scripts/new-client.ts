import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SiteConfig, ThemeConfig } from "../packages/schema/src/index.ts";
import { repoRoot, info, ok, fail, colors } from "./lib.ts";
import { generatePlaceholders, defaultSpecs } from "./gen-placeholders.ts";

/**
 * Crée un nouveau client, prêt à être construit et montré.
 *
 *   pnpm new salon-marie --name "Salon Marie" --plan pro
 *
 * L'objectif est le temps de production : la marge du projet vient de la
 * vitesse de livraison (README §6). Après cette commande, il ne reste qu'à
 * remplir les textes et à remplacer les photos.
 */

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));

function option(name: string, fallback: string): string {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
}

if (!slug) {
  fail(
    'usage : pnpm new <slug> [--name "Nom du commerce"] [--plan essentiel|pro|signature]',
  );
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  fail(`slug invalide : « ${slug} » (minuscules et tirets uniquement)`);
}

const dir = join(repoRoot, "clients", slug);
if (existsSync(dir)) fail(`le client « ${slug} » existe déjà`);

const name = option("name", slug.replace(/-/g, " "));
const plan = option("plan", "pro");
const domain = option("domain", `${slug}.be`);

const site = {
  slug,
  status: "draft",
  plan,
  demo: false,
  domain,
  aliases: [`www.${domain}`],
  languages: {
    default: "fr",
    available: plan === "essentiel" ? ["fr"] : ["fr", "nl"],
  },
  business: {
    name,
    type: "hair_salon",
    tagline: { fr: "À compléter" },
    description: { fr: "À compléter — deux à trois phrases sur le commerce." },
    address: {
      street: "Rue à compléter 1",
      postalCode: "1000",
      city: "Bruxelles",
      country: "BE",
    },
    phone: "+32 2 000 00 00",
    social: {},
  },
  hero: {
    image: "hero.jpg",
    headline: { fr: "À compléter" },
  },
  hours: {
    monday: [],
    tuesday: [{ open: "09:00", close: "18:00" }],
    wednesday: [{ open: "09:00", close: "18:00" }],
    thursday: [{ open: "09:00", close: "18:00" }],
    friday: [{ open: "09:00", close: "19:00" }],
    saturday: [{ open: "09:00", close: "17:00" }],
    sunday: [],
  },
  closures: [],
  services: [],
  team: [],
  gallery: [],
  reviews: [],
  booking: { mode: "none" },
  seo: {},
};

// Style maison : typographie système Apple, surfaces en verre, pilules.
// C'est la palette — et surtout la couleur d'accent — qu'on change d'un client
// à l'autre pour que deux commerces voisins n'aient pas le même site.
const theme = {
  palette: {
    bg: "#000000",
    surface: "#1d1d1f",
    text: "#f5f5f7",
    muted: "#86868b",
    accent: "#0071e3",
    accentText: "#ffffff",
    border: "#2c2c2e",
  },
  fonts: {
    display:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    body: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    displayWeight: 600,
    displayTracking: "-0.022em",
    displayTransform: "none",
    uiTransform: "none",
    uiTracking: "0",
  },
  layout: {
    hero: "fullbleed",
    heroAlign: "center",
    gallery: "grid",
    nav: "overlay",
  },
  radius: "round",
  grain: false,
  effects: { glass: true, blur: 22, reveal: true },
};

// On valide avant d'écrire : le squelette généré ne doit jamais être une source
// d'erreurs au premier build.
const siteCheck = SiteConfig.safeParse(site);
if (!siteCheck.success) {
  fail(`squelette site.json invalide :\n${JSON.stringify(siteCheck.error.issues, null, 2)}`);
}
const themeCheck = ThemeConfig.safeParse(theme);
if (!themeCheck.success) {
  fail(`squelette theme.json invalide :\n${JSON.stringify(themeCheck.error.issues, null, 2)}`);
}

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "site.json"), `${JSON.stringify(site, null, 2)}\n`);
writeFileSync(join(dir, "theme.json"), `${JSON.stringify(theme, null, 2)}\n`);

info("génération des visuels de remplacement");
await generatePlaceholders(join(dir, "media"), defaultSpecs());

ok(`client « ${slug} » créé dans clients/${slug}`);
console.log(`
  ${colors.dim}Suite :${colors.reset}
    1. remplir clients/${slug}/site.json (textes, adresse, prestations)
    2. remplacer clients/${slug}/media/ par les photos de la séance
    3. ${colors.cyan}pnpm dev ${slug}${colors.reset} pour prévisualiser
    4. passer status en « live » puis ${colors.cyan}pnpm build ${slug}${colors.reset}
`);
