import postgres from "postgres";

/**
 * La console lit et écrit dans la même base que l'API, mais n'applique aucune
 * migration : l'API est seule propriétaire du schéma.
 *
 * L'adresse de la base est lue ici plutôt que dans la configuration du serveur
 * web : les outils en ligne de commande, comme la création de compte, n'ont
 * pas à connaître le secret de session ni le chemin du dépôt.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL est requis");

export const sql = postgres(databaseUrl, { max: 5, onnotice: () => {} });

export interface AdminUser {
  /**
   * Le pilote Postgres renvoie les `bigserial` sous forme de chaîne, pour ne
   * pas perdre de précision au-delà de 2^53. Le type dit donc la vérité, et la
   * conversion est explicite là où un nombre est attendu.
   */
  id: string;
  email: string;
  password_hash: string;
  totp_secret: string | null;
}

export async function findAdminByEmail(
  email: string,
): Promise<AdminUser | undefined> {
  const rows = await sql<AdminUser[]>`
    select id, email, password_hash, totp_secret
    from admin_users
    where email = ${email.toLowerCase()}
  `;
  return rows[0];
}

export async function touchLogin(id: string): Promise<void> {
  await sql`update admin_users set last_login_at = now() where id = ${id}`;
}

export async function logPublish(
  adminId: number,
  slug: string,
  action: "save" | "publish" | "suspend" | "resume",
  detail?: string,
): Promise<void> {
  await sql`
    insert into publish_log (admin_id, slug, action, detail)
    values (${adminId}, ${slug}, ${action}, ${detail ?? null})
  `;
}

export interface BookingRow {
  id: string;
  slug: string;
  business_name: string;
  service_name: string;
  preferred_date: string;
  preferred_period: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  note: string | null;
  status: string;
  created_at: string;
}

export async function recentBookings(limit = 100): Promise<BookingRow[]> {
  return sql<BookingRow[]>`
    select b.id, t.slug, t.business_name, b.service_name, b.preferred_date,
           b.preferred_period, b.customer_name, b.customer_email,
           b.customer_phone, b.note, b.status, b.created_at
    from booking_requests b
    join tenants t on t.id = b.tenant_id
    order by b.created_at desc
    limit ${limit}
  `;
}

export async function setBookingStatus(
  id: string,
  status: "new" | "confirmed" | "declined" | "cancelled",
): Promise<void> {
  await sql`update booking_requests set status = ${status} where id = ${id}`;
}
