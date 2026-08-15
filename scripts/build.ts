import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadClient, listClients } from "../packages/schema/src/load.ts";
import {
  repoRoot,
  templateMediaDir,
  distDir,
  run,
  info,
  ok,
  warn,
  fail,
  colors,
} from "./lib.ts";

/**
 * Build d'un client, ou de tous.
 *
 *   pnpm build demo-barbier
 *   pnpm build:all
 *
 * Les builds sont séquentiels : ils partagent le dossier de médias du template,
 * qui est réécrit à chaque client. Vouloir les paralléliser produirait des
 * sites avec les photos du voisin.
 */

const args = process.argv.slice(2);
const buildAll = args.includes("--all");
const slugs = buildAll
  ? listClients(repoRoot)
  : args.filter((a) => !a.startsWith("--"));

if (slugs.length === 0) {
  const known = listClients(repoRoot);
  fail(
    "aucun client indiqué.\n" +
      `  Usage : pnpm build <slug> [<slug>…]  |  pnpm build:all\n` +
      `  Clients : ${known.join(", ") || "(aucun)"}`,
  );
}

let built = 0;
const failures: Array<{ slug: string; error: string }> = [];

/*
 * `PUBLIC_API_URL` est lue par Astro au moment du build et figée dans le HTML.
 * Absente, les formulaires et l'agenda ne sont tout simplement pas rendus : le
 * site paraît normal mais ne peut plus rien recevoir. C'est une panne muette,
 * et elle mérite donc d'être annoncée avant le build plutôt que découverte par
 * un client qui s'étonne de ne plus avoir de demandes.
 */
const apiUrl = process.env.PUBLIC_API_URL?.trim();

for (const slug of slugs) {
  console.log(`\n${colors.dim}────────────────────────${colors.reset}`);
  info(`build ${colors.cyan}${slug}${colors.reset}`);

  try {
    // Valide avant toute chose : une erreur de contenu doit arrêter le build
    // plutôt que produire un site cassé (README §6).
    const client = loadClient(repoRoot, slug);

    if (client.site.status === "draft") {
      warn("statut « draft » — construit pour prévisualisation, à ne pas déployer");
    }
    if (client.site.status === "suspended") {
      warn("statut « suspended » — génère la page « site indisponible »");
    }
    if (!apiUrl && client.site.tenantId) {
      warn(
        "PUBLIC_API_URL absente : ni formulaire de contact ni réservation dans" +
          " le site produit — exporter la variable avant de construire",
      );
    }

    // Les photos passent par `src/` pour bénéficier du pipeline d'images
    // d'Astro (redimensionnement, AVIF/WebP, srcset).
    rmSync(templateMediaDir, { recursive: true, force: true });
    mkdirSync(templateMediaDir, { recursive: true });
    if (existsSync(client.mediaDir)) {
      cpSync(client.mediaDir, templateMediaDir, { recursive: true });
    } else {
      warn(`aucun dossier media/ pour ${slug}`);
    }

    rmSync(join(distDir, slug), { recursive: true, force: true });

    await run("pnpm", ["--filter", "@bxl/template", "run", "build"], {
      CLIENT: slug,
    });

    ok(`${slug} → dist/${slug}`);
    built += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${colors.red}✗${colors.reset} ${slug} : ${message}`);
    failures.push({ slug, error: message });
  }
}

// Nettoyage : ne pas laisser les photos du dernier client dans l'arbre de
// travail, elles brouilleraient un `pnpm dev` lancé ensuite.
rmSync(templateMediaDir, { recursive: true, force: true });

console.log("");
if (failures.length > 0) {
  fail(
    `${built} site(s) construit(s), ${failures.length} en échec : ` +
      failures.map((f) => f.slug).join(", "),
  );
}
ok(`${built} site(s) construit(s)`);
