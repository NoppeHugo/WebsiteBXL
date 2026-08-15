import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadClient } from "@bxl/schema/load";
import { sql, migrate } from "../db.ts";

/**
 * Enregistre un commerce auprès de l'API, à partir de son `site.json`.
 *
 *   pnpm tenant demo-barbier --email salon@exemple.be
 *
 * Génère et écrit le `tenantId` dans `site.json` s'il manque : le formulaire
 * de réservation et celui de contact en dépendent, et le saisir à la main est
 * une source d'erreur inutile.
 */

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));

function option(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : undefined;
}

if (!slug) {
  console.error("usage : pnpm tenant <slug> [--email destinataire@exemple.be]");
  process.exit(1);
}

const client = loadClient(repoRoot, slug);
const sitePath = join(client.dir, "site.json");

let tenantId = client.site.tenantId;
if (!tenantId) {
  tenantId = randomUUID();
  const raw = JSON.parse(readFileSync(sitePath, "utf8")) as Record<string, unknown>;
  raw.tenantId = tenantId;
  writeFileSync(sitePath, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`tenantId généré et écrit dans clients/${slug}/site.json`);
}

const notifyEmail = option("email") ?? client.site.business.email;
if (!notifyEmail) {
  console.error(
    "aucune adresse de destination : renseigner business.email dans site.json, ou passer --email",
  );
  process.exit(1);
}

// L'origine autorisée à appeler l'API est le domaine du client, en HTTPS.
const origin = `https://${client.site.domain}`;

await migrate();

await sql`
  insert into tenants (id, slug, business_name, notify_email, origin)
  values (${tenantId}, ${slug}, ${client.site.business.name}, ${notifyEmail}, ${origin})
  on conflict (id) do update set
    slug          = excluded.slug,
    business_name = excluded.business_name,
    notify_email  = excluded.notify_email,
    origin        = excluded.origin,
    updated_at    = now()
`;

console.log(`✓ ${slug} enregistré`);
console.log(`  tenantId : ${tenantId}`);
console.log(`  courriels envoyés à : ${notifyEmail}`);
console.log(`  origine autorisée : ${origin}`);

await sql.end();
