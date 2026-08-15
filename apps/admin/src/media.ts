import { readdirSync, existsSync, mkdirSync, unlinkSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import sharp from "sharp";

/**
 * Gestion des photos d'un client.
 *
 * Les fichiers vivent dans `clients/<slug>/media/` et sont poussés par git,
 * comme le reste du contenu. Ils sont retraités à l'envoi : les images sorties
 * d'un appareil photo pèsent plusieurs dizaines de mégaoctets, et versionner
 * ça alourdirait le dépôt pour rien — le pipeline du site regénère de toute
 * façon toutes les tailles nécessaires.
 */

/** Bord le plus long conservé. Au-delà, aucun écran n'y gagne quoi que ce soit. */
const MAX_EDGE = 2600;

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

export interface MediaFile {
  name: string;
  bytes: number;
}

/*
 * La racine du dépôt est passée en argument plutôt que lue dans la
 * configuration du serveur : le module reste testable sans monter tout
 * l'environnement web.
 */
function mediaDir(repoRoot: string, slug: string): string {
  return join(repoRoot, "clients", slug, "media");
}

/**
 * Normalise un nom de fichier fourni par l'extérieur.
 *
 * `basename` seul ne suffit pas : il faut aussi refuser tout ce qui n'est pas
 * un nom simple, sinon un nom fabriqué pourrait écrire hors du dossier du
 * client.
 */
export function safeName(input: string): string | undefined {
  const base = basename(input).trim().toLowerCase();
  if (!base || base === "." || base === "..") return undefined;

  const stem = base
    .slice(0, base.length - extname(base).length)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  if (!stem) return undefined;
  return `${stem}.jpg`;
}

export function listMedia(repoRoot: string, slug: string): MediaFile[] {
  const dir = mediaDir(repoRoot, slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
    .sort()
    .map((name) => ({ name, bytes: statSync(join(dir, name)).size }));
}

export function mediaPath(
  repoRoot: string,
  slug: string,
  name: string,
): string | undefined {
  const safe = basename(name);
  if (safe !== name) return undefined;
  const path = join(mediaDir(repoRoot, slug), safe);
  return existsSync(path) ? path : undefined;
}

export interface SaveResult {
  ok: boolean;
  name?: string;
  error?: string;
}

/**
 * Enregistre une photo : vérification que c'est bien une image, réduction,
 * conversion en JPEG de qualité élevée.
 */
export async function saveMedia(
  repoRoot: string,
  slug: string,
  originalName: string,
  buffer: Buffer,
): Promise<SaveResult> {
  const name = safeName(originalName);
  if (!name) return { ok: false, error: "nom de fichier inutilisable" };

  let image: sharp.Sharp;
  let meta: sharp.Metadata;
  try {
    image = sharp(buffer, { failOn: "error" });
    meta = await image.metadata();
  } catch {
    // Un fichier qui n'est pas une image doit être refusé ici, pas découvert
    // au moment du build, une semaine plus tard.
    return { ok: false, error: "ce fichier n'est pas une image lisible" };
  }

  if (!meta.width || !meta.height) {
    return { ok: false, error: "image sans dimensions exploitables" };
  }

  const dir = mediaDir(repoRoot, slug);
  mkdirSync(dir, { recursive: true });

  await image
    .rotate() // applique l'orientation EXIF avant de la perdre
    .resize({
      width: Math.min(meta.width, MAX_EDGE),
      height: Math.min(meta.height, MAX_EDGE),
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(join(dir, name));

  return { ok: true, name };
}

export function deleteMedia(repoRoot: string, slug: string, name: string): boolean {
  const path = mediaPath(repoRoot, slug, name);
  if (!path) return false;
  unlinkSync(path);
  return true;
}
