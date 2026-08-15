import { fileURLToPath } from "node:url";
import { loadClient } from "@bxl/schema/load";
import type { Language, LocalizedText } from "@bxl/schema";
import { t as translate } from "@bxl/schema";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const slug = process.env.CLIENT;
if (!slug) throw new Error("variable CLIENT manquante");

/** Le client courant, chargé et validé une seule fois pour tout le build. */
export const client = loadClient(repoRoot, slug);
export const site = client.site;
export const theme = client.theme;

export const defaultLang = site.languages.default;
export const languages = site.languages.available;

/** Traduit avec repli sur la langue par défaut du client. */
export function t(text: LocalizedText | undefined, lang: Language): string {
  return translate(text, lang, defaultLang);
}

/**
 * Construit une URL interne. La langue par défaut vit à la racine (`/`), les
 * autres sous leur préfixe (`/nl/`) — meilleur pour le référencement que de
 * rediriger la racine.
 */
export function path(lang: Language, anchor?: string): string {
  const base = lang === defaultLang ? "/" : `/${lang}/`;
  return anchor ? `${base}#${anchor}` : base;
}

/**
 * Adresse d'une page secondaire — mentions légales, annulation — dans une
 * langue donnée. Même règle que l'accueil : la langue par défaut vit à la
 * racine, les autres sous leur préfixe.
 */
export function subPath(lang: Language, segment: string): string {
  return lang === defaultLang ? `/${segment}/` : `/${lang}/${segment}/`;
}

/** Les langues autres que celle par défaut, pour `getStaticPaths`. */
export function secondaryLanguages(): Language[] {
  return languages.filter((l) => l !== defaultLang);
}
