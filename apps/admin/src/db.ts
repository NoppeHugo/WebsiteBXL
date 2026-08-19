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
  /**
   * `null` : l'exploitant, qui voit tous les commerces.
   * Renseigné : un commerçant, qui ne voit que le sien.
   */
  tenant_slug: string | null;
  must_change_password: boolean;
}

export async function findAdminByEmail(
  email: string,
): Promise<AdminUser | undefined> {
  const rows = await sql<AdminUser[]>`
    select id, email, password_hash, totp_secret, tenant_slug, must_change_password
    from admin_users
    where email = ${email.toLowerCase()}
  `;
  return rows[0];
}

/**
 * Relu à chaque requête, à partir de l'identifiant porté par la session.
 *
 * Le jeton de session est signé et pourrait suffire à porter le rôle — mais il
 * vaut alors jusqu'à son échéance, douze heures plus tard. Un accès retiré à un
 * commerçant qui n'est plus client resterait valable une demi-journée, et un
 * compte transformé en compte exploitant le deviendrait sans reconnexion. Une
 * requête locale par page est un prix négligeable pour que la révocation soit
 * immédiate.
 */
export async function findAdminById(id: number): Promise<AdminUser | undefined> {
  const rows = await sql<AdminUser[]>`
    select id, email, password_hash, totp_secret, tenant_slug, must_change_password
    from admin_users
    where id = ${id}
  `;
  return rows[0];
}

export async function touchLogin(id: string): Promise<void> {
  await sql`update admin_users set last_login_at = now() where id = ${id}`;
}

export interface CompteClient {
  id: string;
  email: string;
  tenant_slug: string;
  must_change_password: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

/** Les accès commerçants, pour la page de gestion de l'exploitant. */
export async function comptesClients(): Promise<CompteClient[]> {
  return sql<CompteClient[]>`
    select id, email, tenant_slug, must_change_password, last_login_at, created_at
    from admin_users
    where tenant_slug is not null
    order by tenant_slug
  `;
}

export async function compteDuClient(slug: string): Promise<CompteClient | undefined> {
  const rows = await sql<CompteClient[]>`
    select id, email, tenant_slug, must_change_password, last_login_at, created_at
    from admin_users
    where tenant_slug = ${slug}
  `;
  return rows[0];
}

/**
 * Crée l'accès d'un commerçant, ou remplace son mot de passe s'il existe déjà.
 *
 * Le conflit est traité sur l'adresse **et** sur le site : une adresse déjà
 * connue appartient à quelqu'un, et un site a déjà son compte. Sans cela, un
 * second appel créerait un doublon dont on ne saurait plus lequel fait foi.
 */
export async function poserAccesClient(
  email: string,
  slug: string,
  passwordHash: string,
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const normalise = email.trim().toLowerCase();

  const existant = await sql<Array<{ id: string; tenant_slug: string | null }>>`
    select id, tenant_slug from admin_users where email = ${normalise}
  `;
  if (existant[0] && existant[0].tenant_slug !== slug) {
    return {
      ok: false,
      raison:
        existant[0].tenant_slug === null
          ? "Cette adresse est celle d'un compte d'exploitation, pas d'un commerçant."
          : `Cette adresse sert déjà au commerce « ${existant[0].tenant_slug} ».`,
    };
  }

  await sql`
    insert into admin_users (email, password_hash, tenant_slug, must_change_password)
    values (${normalise}, ${passwordHash}, ${slug}, true)
    on conflict (email) do update set
      password_hash        = excluded.password_hash,
      tenant_slug          = excluded.tenant_slug,
      must_change_password = true
  `;
  return { ok: true };
}

export async function changerMotDePasse(id: string, passwordHash: string): Promise<void> {
  await sql`
    update admin_users
    set password_hash = ${passwordHash}, must_change_password = false
    where id = ${id}
  `;
}

export async function retirerAccesClient(slug: string): Promise<void> {
  // Supprimé plutôt que désactivé : un accès retiré doit l'être franchement.
  // Le journal de publication conserve la trace des actions passées, son
  // `admin_id` étant mis à NULL et non effacé.
  await sql`delete from admin_users where tenant_slug = ${slug}`;
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

export interface EtatPublication {
  derniereModification: Date | null;
  derniereMiseEnLigne: Date | null;
  /** Vrai si le contenu enregistré est plus récent que ce qui est servi. */
  enAttente: boolean;
}

/**
 * Ce qui est enregistré est-il en ligne ?
 *
 * C'est la question que se pose quiconque ouvre la console, et à laquelle rien
 * ne répondait : enregistrer écrit dans git, mettre en ligne reconstruit le
 * site, et les deux boutons se ressemblaient. On pouvait donc corriger un
 * horaire, voir « enregistré », et laisser le site afficher l'ancien pendant
 * des semaines.
 */
export async function etatPublication(slug: string): Promise<EtatPublication> {
  const lignes = await sql<{ action: string; created_at: Date }[]>`
    select action, max(created_at) as created_at
      from publish_log
     where slug = ${slug}
       and action in ('save', 'publish')
     group by action
  `;

  const quand = (action: string) =>
    lignes.find((l) => l.action === action)?.created_at ?? null;

  const derniereModification = quand("save");
  const derniereMiseEnLigne = quand("publish");

  return {
    derniereModification,
    derniereMiseEnLigne,
    // Jamais publié mais déjà modifié compte comme en attente : c'est le cas
    // d'un client qu'on prépare et qu'on oublie de mettre en ligne.
    enAttente:
      derniereModification !== null &&
      (derniereMiseEnLigne === null || derniereModification > derniereMiseEnLigne),
  };
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

/* -------------------------------------------------------------------------- */
/* Espace client                                                              */
/* -------------------------------------------------------------------------- */

/*
 * Toutes les lectures de cette section passent par le `slug`, jamais par un
 * identifiant reçu de la page. Le commerçant ne peut donc rien demander d'autre
 * que son propre commerce, même en fabriquant une requête : la jointure sur
 * `tenants.slug` est le filtre, et il vient de la session.
 */

export interface RendezVous {
  id: string;
  service_name: string;
  debut: Date;
  fin: Date;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  note: string | null;
  status: string;
  resource_name: string;
}

/** Les rendez-vous à venir d'un commerce, du plus proche au plus lointain. */
export async function rendezVousDuCommerce(
  slug: string,
  limite = 50,
): Promise<RendezVous[]> {
  return sql<RendezVous[]>`
    select a.id, a.service_name,
           lower(a.during) as debut, upper(a.during) as fin,
           a.customer_name, a.customer_email, a.customer_phone, a.note, a.status,
           r.name as resource_name
    from appointments a
    join tenants t on t.id = a.tenant_id
    join resources r on r.id = a.resource_id
    where t.slug = ${slug}
      and a.status = 'booked'
      and upper(a.during) >= now()
    order by lower(a.during)
    limit ${limite}
  `;
}

/**
 * Annule un rendez-vous, à condition qu'il appartienne bien à ce commerce.
 *
 * Le `slug` est repris dans la clause `where` plutôt que vérifié avant : entre
 * une vérification et une écriture séparées, il y a une fenêtre — et surtout
 * deux endroits où la règle peut être oubliée.
 *
 * Renvoie la ligne annulée, pour que l'appelant puisse prévenir le client final.
 */
export async function annulerRendezVous(
  slug: string,
  id: string,
): Promise<RendezVous | undefined> {
  const rows = await sql<RendezVous[]>`
    update appointments a
    set status = 'cancelled'
    from tenants t, resources r
    where t.id = a.tenant_id and r.id = a.resource_id
      and t.slug = ${slug} and a.id = ${id} and a.status = 'booked'
    returning a.id, a.service_name,
              lower(a.during) as debut, upper(a.during) as fin,
              a.customer_name, a.customer_email, a.customer_phone, a.note,
              a.status, r.name as resource_name
  `;
  return rows[0];
}

export interface MessageRecu {
  id: string;
  customer_name: string;
  customer_email: string;
  message: string;
  created_at: Date;
}

export async function messagesDuCommerce(
  slug: string,
  limite = 50,
): Promise<MessageRecu[]> {
  return sql<MessageRecu[]>`
    select m.id, m.customer_name, m.customer_email, m.message, m.created_at
    from contact_messages m
    join tenants t on t.id = m.tenant_id
    where t.slug = ${slug}
    order by m.created_at desc
    limit ${limite}
  `;
}

/** De quoi poser une pastille de comptage sur les cartes de l'accueil. */
export async function comptesDuCommerce(
  slug: string,
): Promise<{ rendezVous: number; messages: number }> {
  const rows = await sql<Array<{ rdv: string; msg: string }>>`
    select
      (select count(*) from appointments a
         join tenants t on t.id = a.tenant_id
        where t.slug = ${slug} and a.status = 'booked'
          and upper(a.during) >= now()) as rdv,
      (select count(*) from contact_messages m
         join tenants t on t.id = m.tenant_id
        where t.slug = ${slug} and m.created_at > now() - interval '30 days') as msg
  `;
  return {
    rendezVous: Number(rows[0]?.rdv ?? 0),
    messages: Number(rows[0]?.msg ?? 0),
  };
}

export interface CommandeRecue {
  id: string;
  occasion_name: string | null;
  budget_cents: number | null;
  /** Le pilote Postgres rend les colonnes `date` sous forme d'objets Date. */
  wanted_day: Date | null;
  /** Heure et couverts : une demande de table seulement. */
  wanted_time: string | null;
  party_size: number | null;
  mode: string;
  address: string | null;
  card_message: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  note: string | null;
  status: string;
  created_at: Date;
}

/**
 * Les commandes d'un commerce, la plus urgente d'abord.
 *
 * Triées par date souhaitée et non par date de réception : ce que le fleuriste
 * doit préparer demain compte plus que ce qui est arrivé hier. Les commandes
 * sans date — « dès que possible » — passent en tête, parce qu'elles attendent
 * un appel.
 */
export async function commandesDuCommerce(
  slug: string,
  limite = 50,
): Promise<CommandeRecue[]> {
  return sql<CommandeRecue[]>`
    select o.id, o.occasion_name, o.budget_cents, o.wanted_day, o.mode,
           to_char(o.wanted_time, 'HH24:MI') as wanted_time, o.party_size,
           o.address, o.card_message, o.customer_name, o.customer_email,
           o.customer_phone, o.note, o.status, o.created_at
    from orders o
    join tenants t on t.id = o.tenant_id
    where t.slug = ${slug}
      and o.status in ('new', 'confirmed')
    order by o.wanted_day asc nulls first, o.created_at asc
    limit ${limite}
  `;
}

/**
 * Change l'état d'une commande, à condition qu'elle appartienne à ce commerce.
 *
 * Le `slug` fait partie de la condition, il n'est pas vérifié à part : entre
 * une vérification et une écriture séparées il y a une fenêtre, et surtout deux
 * endroits où la règle peut être oubliée.
 */
export async function changerEtatCommande(
  slug: string,
  id: string,
  etat: "confirmed" | "declined" | "done",
): Promise<boolean> {
  const lignes = await sql`
    update orders o
    set status = ${etat}
    from tenants t
    where t.id = o.tenant_id and t.slug = ${slug} and o.id = ${id}
    returning o.id
  `;
  return lignes.length > 0;
}

/** Commandes à traiter, pour la pastille de l'accueil. */
export async function commandesEnAttente(slug: string): Promise<number> {
  const rows = await sql<Array<{ n: string }>>`
    select count(*) as n from orders o
    join tenants t on t.id = o.tenant_id
    where t.slug = ${slug} and o.status = 'new'
  `;
  return Number(rows[0]?.n ?? 0);
}
