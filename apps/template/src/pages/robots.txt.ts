import type { APIRoute } from "astro";
import { site } from "../lib/client.ts";

/**
 * Un site de démonstration, un brouillon ou un site suspendu ne doit jamais
 * être indexé : il concurrencerait le vrai site du client ou afficherait une
 * page d'indisponibilité dans les résultats de recherche.
 */
export const GET: APIRoute = ({ site: base }) => {
  const indexable = site.status === "live" && !site.demo;

  const body = indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", base).href}\n`
    : "User-agent: *\nDisallow: /\n";

  return new Response(body, { headers: { "content-type": "text/plain" } });
};
