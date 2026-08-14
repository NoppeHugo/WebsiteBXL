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

function block(slug: string, domains: string[]): string {
  return `# Généré par \`pnpm caddy ${slug}\` — ne pas modifier à la main.
${domains.join(", ")} {
	import commun
	root * /srv/sites/${slug}/current
	file_server
}
`;
}

for (const slug of slugs) {
  const { site } = loadClient(repoRoot, slug);

  if (site.status === "draft") {
    info(`${slug} ignoré (statut « draft »)`);
    continue;
  }

  const domains = [site.domain, ...site.aliases];
  const content = block(slug, domains);

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    const path = join(outDir, `${slug}.caddy`);
    writeFileSync(path, content);
    ok(`${path} → ${domains.join(", ")}`);
  } else {
    console.log(`\n${colors.dim}# ${slug}${colors.reset}\n${content}`);
  }
}
