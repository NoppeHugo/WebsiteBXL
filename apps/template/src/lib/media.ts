import type { ImageMetadata } from "astro";

/**
 * Les photos du client sont copiées dans `src/media/` par le script de build,
 * ce qui les fait passer par le pipeline d'optimisation d'Astro (redimen-
 * sionnement, AVIF/WebP, srcset). Elles sont l'argument de vente du projet :
 * elles doivent être belles et légères, jamais servies brutes.
 */
const files = import.meta.glob<{ default: ImageMetadata }>(
  "../media/**/*.{jpg,jpeg,png,webp,avif}",
  { eager: true },
);

const byName = new Map<string, ImageMetadata>();
for (const [key, mod] of Object.entries(files)) {
  byName.set(key.replace("../media/", ""), mod.default);
}

function normalize(src: string): string {
  return src.replace(/^\.?\/*/, "");
}

/**
 * Résout une photo déclarée dans `site.json`. Absente, le build échoue :
 * un site livré avec une image cassée coûte plus cher qu'un build rouge.
 */
export function media(src: string): ImageMetadata {
  const found = byName.get(normalize(src));
  if (!found) {
    const available = [...byName.keys()].sort().join(", ") || "(aucune)";
    throw new Error(
      `photo introuvable : « ${src} ». Fichiers disponibles : ${available}`,
    );
  }
  return found;
}

export function tryMedia(src: string | undefined): ImageMetadata | undefined {
  return src ? media(src) : undefined;
}
