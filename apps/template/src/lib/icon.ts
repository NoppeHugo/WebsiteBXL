import { site, theme } from "./client.ts";

/**
 * Icône du site, dérivée de l'initiale du commerce et de sa couleur d'accent.
 *
 * Générée plutôt que dessinée : un client sur deux n'a pas de logo utilisable,
 * et un onglet sans favicon fait « site pas fini » — précisément l'impression
 * qu'on vend contre.
 */
export function iconSvg({ rounded = true, size = 512 } = {}): string {
  const initial = [...site.business.name.trim()][0]?.toUpperCase() ?? "•";
  const radius = rounded ? size * 0.22 : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${theme.palette.accent}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${size * 0.56}" font-weight="600"
        fill="${theme.palette.accentText}">${escapeXml(initial)}</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[
        c
      ]!,
  );
}
