import type { APIRoute } from "astro";
import { site, languages, path } from "../lib/client.ts";
import { htmlLang } from "../lib/i18n.ts";

/**
 * Plan du site, avec les correspondances entre langues.
 *
 * C'est la contrepartie technique de l'argument de vente : déclarer à Google
 * que la version néerlandaise et la version française sont le même commerce,
 * pas deux sites concurrents.
 */
export const GET: APIRoute = ({ site: base }) => {
  // Un site non publié n'a rien à déclarer, mais doit tout de même servir un
  // XML valide : un site suspendu reste en ligne, et un fichier vide renvoyé
  // avec un code 200 est une erreur d'exploration côté Google.
  const publishable = Boolean(base) && site.status === "live" && !site.demo;

  const pages = publishable ? ["", "legal"] : [];

  const urls = languages.flatMap((lang) =>
    pages.map((page) => {
      const loc = new URL(
        `${path(lang).slice(1)}${page ? `${page}/` : ""}`,
        base!,
      ).href;

      const alternates = languages
        .map((other) => {
          const href = new URL(
            `${path(other).slice(1)}${page ? `${page}/` : ""}`,
            base!,
          ).href;
          return `    <xhtml:link rel="alternate" hreflang="${htmlLang(other)}" href="${href}"/>`;
        })
        .join("\n");

      return `  <url>\n    <loc>${loc}</loc>\n${alternates}\n  </url>`;
    }),
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;

  return new Response(body, { headers: { "content-type": "application/xml" } });
};
