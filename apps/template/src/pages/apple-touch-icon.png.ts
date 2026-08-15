import type { APIRoute } from "astro";
import sharp from "sharp";
import { iconSvg } from "../lib/icon.ts";

/**
 * Icône utilisée quand un visiteur ajoute le site à l'écran d'accueil de son
 * iPhone. iOS applique lui-même l'arrondi et ne gère pas la transparence :
 * l'image est donc carrée et pleine.
 */
export const GET: APIRoute = async () => {
  const png = await sharp(Buffer.from(iconSvg({ rounded: false, size: 180 })))
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png" },
  });
};
