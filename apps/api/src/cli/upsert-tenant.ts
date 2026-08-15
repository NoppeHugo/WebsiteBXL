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

/*
 * Projection du contenu vers la base.
 *
 * Les horaires et les prestations vivent dans git ; l'agenda en a besoin à
 * l'exécution, et l'API n'a pas accès au dépôt. On en dépose donc une copie
 * ici à chaque enregistrement. Git reste la source de vérité : cette copie est
 * intégralement réécrite, jamais éditée de son côté.
 */
const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

await sql`delete from tenant_services where tenant_id = ${tenantId}`;
for (const service of client.site.services) {
  await sql`
    insert into tenant_services (tenant_id, service_id, name, duration_min, price_cents)
    values (
      ${tenantId}, ${service.id},
      ${service.name[client.site.languages.default] ?? service.id},
      ${service.durationMin},
      ${service.price === null ? null : Math.round(service.price * 100)}
    )
  `;
}

await sql`delete from tenant_hours where tenant_id = ${tenantId}`;
for (const [day, index] of Object.entries(WEEKDAY_INDEX)) {
  for (const slot of client.site.hours[day as keyof typeof client.site.hours]) {
    await sql`
      insert into tenant_hours (tenant_id, weekday, opens, closes)
      values (${tenantId}, ${index}, ${slot.open}, ${slot.close})
      on conflict do nothing
    `;
  }
}

await sql`delete from tenant_closures where tenant_id = ${tenantId}`;
for (const closure of client.site.closures) {
  await sql`
    insert into tenant_closures (tenant_id, from_day, to_day)
    values (${tenantId}, ${closure.from}, ${closure.to})
    on conflict do nothing
  `;
}

/*
 * L'équipe affichée sur le site est aussi la liste des personnes qui peuvent
 * recevoir : un salon à trois fauteuils prend trois rendez-vous en parallèle.
 * Sans équipe déclarée, on suppose une personne.
 */
const team = client.site.team.length > 0
  ? client.site.team.map((m) => m.name)
  : [client.site.business.name];

await sql`
  update resources set active = false where tenant_id = ${tenantId}
`;
for (const name of team) {
  await sql`
    insert into resources (tenant_id, name, active)
    values (${tenantId}, ${name}, true)
    on conflict (tenant_id, name) do update set active = true
  `;
}

console.log(`✓ ${slug} enregistré`);
console.log(`  prestations : ${client.site.services.length}`);
console.log(`  personnes qui reçoivent : ${team.length}`);
console.log(`  tenantId : ${tenantId}`);
console.log(`  courriels envoyés à : ${notifyEmail}`);
console.log(`  origine autorisée : ${origin}`);

await sql.end();
