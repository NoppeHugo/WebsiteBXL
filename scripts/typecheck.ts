import { listClients } from "../packages/schema/src/load.ts";
import { repoRoot, run, info, ok, fail } from "./lib.ts";

/**
 * Relecture des types du monorepo.
 *
 *   pnpm typecheck
 *
 * Deux passes, parce que le template ne se vérifie pas comme le reste : ses
 * fichiers `.astro` demandent l'outil d'Astro, le code Node passe par `tsc`.
 *
 * Ce contrôle a sa raison d'être : Node exécute les `.ts` en effaçant
 * simplement les types, sans jamais les vérifier. Sans cette commande, une
 * erreur de type ne se manifeste qu'à l'exécution — c'est ainsi qu'une
 * échéance d'abonnement lue au mauvais endroit dans l'objet Stripe est restée
 * invisible jusqu'ici.
 */

info("code Node (tsc)");
await run("node_modules/.bin/tsc", ["-p", "tsconfig.json"]).catch(() =>
  fail("erreurs de types dans le code Node"),
);

/*
 * Le template ne se construit que pour un client donné : sa configuration lit
 * `CLIENT`. N'importe lequel convient ici — les types ne dépendent pas des
 * contenus — mais il en faut un.
 */
const [client] = listClients(repoRoot);
if (!client) {
  ok("aucun client : template non vérifié");
  process.exit(0);
}

info(`template (astro check, client « ${client} »)`);
await run(
  "pnpm",
  ["--filter", "@bxl/template", "exec", "astro", "check", "--minimumSeverity", "error"],
  { CLIENT: client },
).catch(() => fail("erreurs de types dans le template"));

ok("types vérifiés");
