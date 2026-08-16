import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadClient, listClients } from "../packages/schema/src/load.ts";
import { repoRoot, info, ok, fail, colors } from "./lib.ts";

/**
 * Génère le bloc Caddy d'un client à partir de son `site.json`.
 *
 *   pnpm caddy demo-barbier      → affiche le bloc
 *   pnpm caddy --all --out ./out → écrit un fichier par client
 *
 * Le domaine et ses alias sont déjà dans les données du client : les ressaisir
 * à la main dans une configuration serveur est le genre de duplication qui
 * finit par diverger.
 */

const args = process.argv.slice(2);
const all = args.includes("--all");
const outIndex = args.indexOf("--out");
const outDir = outIndex !== -1 ? args[outIndex + 1] : undefined;
const slugs = all
  ? listClients(repoRoot)
  : args.filter((a) => !a.startsWith("--") && a !== outDir);

if (slugs.length === 0) {
  fail("usage : pnpm caddy <slug> [--out <dossier>]  |  pnpm caddy --all --out <dossier>");
}

/**
 * Bloc Caddy d'un client.
 *
 * Le site n'est servi que sur son domaine canonique ; les alias redirigent
 * vers lui de façon permanente. Servir le même contenu sur plusieurs adresses
 * disperserait le référencement entre elles, et laisserait un client donner
 * une adresse dont on voudrait plus tard qu'elle ne soit plus la sienne —
 * typiquement le sous-domaine de service utilisé pendant la vente, une fois
 * le vrai domaine acheté.
 *
 * La redirection conserve le chemin et la requête : un lien vers une page
 * précise ne retombe pas sur l'accueil.
 */
function block(slug: string, domain: string, aliases: string[]): string {
  const redirect =
    aliases.length === 0
      ? ""
      : `
${aliases.join(", ")} {
	redir https://${domain}{uri} permanent
}
`;

  return `# Généré par \`pnpm caddy ${slug}\` — ne pas modifier à la main.
${domain} {
	import commun
	root * /srv/sites/${slug}/current
	file_server
}
${redirect}`;
}

for (const slug of slugs) {
  const { site } = loadClient(repoRoot, slug);

  if (site.status === "draft") {
    info(`${slug} ignoré (statut « draft »)`);
    continue;
  }

  const domains = [site.domain, ...site.aliases];
  const content = block(slug, site.domain, site.aliases);

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    const path = join(outDir, `${slug}.caddy`);
    writeFileSync(path, content);
    ok(`${path} → ${domains.join(", ")}`);
  } else {
    console.log(`\n${colors.dim}# ${slug}${colors.reset}\n${content}`);
  }
}
