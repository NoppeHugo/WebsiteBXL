import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import postgres from "postgres";
import { config } from "./config.ts";

export const sql = postgres(config.DATABASE_URL, {
  max: 10,
  onnotice: () => {},
});

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * Migrations appliquées au démarrage, dans l'ordre des noms de fichiers.
 *
 * Suffisant pour un service opéré par une seule personne : pas d'outil
 * supplémentaire à installer, et le déploiement ne peut pas oublier une étape.
 */
export async function migrate(): Promise<void> {
  await sql`
    create table if not exists schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const applied = new Set(
    (await sql<{ name: string }[]>`select name from schema_migrations`).map(
      (r) => r.name,
    ),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const statements = readFileSync(join(migrationsDir, file), "utf8");

    // Chaque migration est atomique : si elle échoue à mi-parcours, rien n'est
    // appliqué et le serveur refuse de démarrer plutôt que de tourner sur un
    // schéma incomplet.
    await sql.begin(async (tx) => {
      await tx.unsafe(statements);
      await tx`insert into schema_migrations (name) values (${file})`;
    });

    console.log(`migration appliquée : ${file}`);
  }
}

/**
 * Purge des données personnelles au-delà de la durée de conservation.
 *
 * Obligation RGPD, pas une optimisation de stockage : conserver indéfiniment
 * les coordonnées des clients finaux d'un salon nous exposerait, et exposerait
 * le commerçant dont nous sommes le sous-traitant.
 */
export async function purgeExpired(): Promise<{
  bookings: number;
  messages: number;
}> {
  const bookings = await sql`
    delete from booking_requests
    where created_at < now() - ${`${config.RETENTION_BOOKING_DAYS} days`}::interval
  `;
  const messages = await sql`
    delete from contact_messages
    where created_at < now() - ${`${config.RETENTION_CONTACT_DAYS} days`}::interval
  `;
  return { bookings: bookings.count, messages: messages.count };
}

export interface Tenant {
  id: string;
  slug: string;
  business_name: string;
  notify_email: string;
  origin: string;
}

export async function findTenant(id: string): Promise<Tenant | undefined> {
  const rows = await sql<Tenant[]>`
    select id, slug, business_name, notify_email, origin
    from tenants
    where id = ${id}
  `;
  return rows[0];
}

export async function listOrigins(): Promise<string[]> {
  const rows = await sql<{ origin: string }[]>`select origin from tenants`;
  return rows.map((r) => r.origin);
}
