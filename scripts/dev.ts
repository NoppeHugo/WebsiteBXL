import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { loadClient, listClients } from "../packages/schema/src/load.ts";
import { repoRoot, templateMediaDir, run, info, fail } from "./lib.ts";

/**
 * Serveur de développement sur un client.
 *
 *   pnpm dev demo-barbier
 *
 * Les photos sont copiées une fois au démarrage. Ajouter une photo pendant la
 * session demande de relancer la commande.
 */

const slug = process.argv[2];
if (!slug) {
  fail(
    `usage : pnpm dev <slug>\n  Clients : ${listClients(repoRoot).join(", ") || "(aucun)"}`,
  );
}

const client = loadClient(repoRoot, slug);

rmSync(templateMediaDir, { recursive: true, force: true });
mkdirSync(templateMediaDir, { recursive: true });
if (existsSync(client.mediaDir)) {
  cpSync(client.mediaDir, templateMediaDir, { recursive: true });
}

info(`dev ${slug} — ${client.site.business.name}`);

await run("pnpm", ["--filter", "@bxl/template", "run", "dev"], {
  CLIENT: slug,
});
