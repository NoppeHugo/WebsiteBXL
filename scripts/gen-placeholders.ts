import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { repoRoot, info, ok, fail } from "./lib.ts";

/**
 * Génère des visuels de remplacement.
 *
 * Ils existent pour une seule raison : un nouveau client doit se construire et
 * s'afficher correctement avant la séance photo, pour pouvoir être montré au
 * commerçant. Ils sont volontairement abstraits — jamais une photo trouvée
 * ailleurs, qui poserait un problème de droits et se verrait immédiatement.
 */

export interface PlaceholderSpec {
  file: string;
  width: number;
  height: number;
  /** Teinte en degrés, pour varier les images d'une même galerie. */
  hue: number;
}

function svg({ width, height, hue }: PlaceholderSpec): string {
  // Assez clairs pour rester lisibles sur un thème sombre : un remplacement
  // invisible empêche de juger la mise en page avant la séance photo.
  const light = `hsl(${hue}, 14%, 44%)`;
  const dark = `hsl(${hue}, 18%, 13%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="v" cx="50%" cy="38%" r="72%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <rect width="${width}" height="${height}" filter="url(#n)" opacity="0.06"/>
  <rect width="${width}" height="${height}" fill="url(#v)"/>
</svg>`;
}

export async function generatePlaceholders(
  mediaDir: string,
  specs: PlaceholderSpec[],
): Promise<void> {
  mkdirSync(mediaDir, { recursive: true });
  for (const spec of specs) {
    await sharp(Buffer.from(svg(spec)))
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(join(mediaDir, spec.file));
  }
}

/** Jeu standard : un hero, six photos de galerie, trois portraits. */
export function defaultSpecs(): PlaceholderSpec[] {
  return [
    { file: "hero.jpg", width: 2400, height: 1600, hue: 24 },
    ...Array.from({ length: 6 }, (_, i) => ({
      file: `galerie-${i + 1}.jpg`,
      width: 1400,
      height: 1750,
      hue: 16 + i * 6,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      file: `equipe-${i + 1}.jpg`,
      width: 900,
      height: 1200,
      hue: 22 + i * 8,
    })),
  ];
}

// Exécution directe : `pnpm placeholders <slug>`
if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = process.argv[2];
  if (!slug) fail("usage : pnpm placeholders <slug>");
  const mediaDir = join(repoRoot, "clients", slug, "media");
  info(`génération des visuels de remplacement dans clients/${slug}/media`);
  await generatePlaceholders(mediaDir, defaultSpecs());
  ok("visuels générés — à remplacer par les vraies photos après la séance");
}
