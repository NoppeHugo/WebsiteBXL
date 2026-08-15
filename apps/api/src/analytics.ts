import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "postgres";

/**
 * Comptage des visiteurs sans cookie.
 *
 * L'empreinte combine l'adresse IP, le navigateur, le commerce et un sel qui
 * change chaque jour. Elle permet de dire « 340 visiteurs distincts ce
 * mois-ci » sans jamais conserver d'adresse IP, et devient inexploitable dès
 * le lendemain : impossible de suivre quelqu'un dans le temps, y compris pour
 * nous.
 *
 * Conséquence pratique et vendeuse : aucun cookie, donc aucun bandeau de
 * consentement à imposer aux visiteurs du salon.
 *
 * Le client SQL est passé en argument plutôt qu'importé : l'interface
 * d'administration réutilise ces agrégats, et importer la base de l'API
 * entraînerait avec elle toute sa configuration — clé d'envoi de courriels
 * comprise, qu'elle n'a aucune raison de connaître.
 */

const cache = new Map<string, string>();

export async function saltForToday(sql: Sql, today = new Date()): Promise<string> {
  const day = today.toISOString().slice(0, 10);

  const cached = cache.get(day);
  if (cached) return cached;

  const rows = await sql<{ salt: string }[]>`
    insert into visitor_salts (day, salt)
    values (${day}, ${randomBytes(32).toString("base64")})
    on conflict (day) do update set day = excluded.day
    returning salt
  `;

  const salt = rows[0]!.salt;

  // Le cache ne garde que le jour courant : conserver les sels passés en
  // mémoire rouvrirait la porte au suivi qu'ils servent à fermer.
  cache.clear();
  cache.set(day, salt);
  return salt;
}

export function visitorHash(parts: {
  salt: string;
  ip: string;
  userAgent: string;
  tenantId: string;
}): string {
  return createHash("sha256")
    .update(`${parts.salt}|${parts.tenantId}|${parts.ip}|${parts.userAgent}`)
    .digest("base64url")
    .slice(0, 22);
}

/** Téléphone ou ordinateur : la seule distinction utile au commerçant. */
export function deviceFrom(userAgent: string): "mobile" | "desktop" {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? "mobile" : "desktop";
}

/**
 * Ne garde que le domaine d'origine. Une URL complète de moteur de recherche
 * peut contenir la requête tapée, parfois un nom de personne.
 */
export function referrerHost(referrer: string | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host.slice(0, 120) || undefined;
  } catch {
    return undefined;
  }
}

export interface MonthlySummary {
  views: number;
  visitors: number;
  calls: number;
  directions: number;
  bookings: number;
  contacts: number;
  mobileShare: number;
  topReferrers: Array<{ referrer: string; count: number }>;
}

/** Agrégats d'un mois pour un commerce. `month` au format YYYY-MM. */
export async function monthlySummary(
  sql: Sql,
  tenantId: string,
  month: string,
): Promise<MonthlySummary> {
  const start = `${month}-01`;

  const [totals] = await sql<
    Array<{
      views: string;
      visitors: string;
      calls: string;
      directions: string;
      bookings: string;
      contacts: string;
      mobile: string;
    }>
  >`
    select
      count(*) filter (where kind = 'view')        as views,
      count(distinct visitor_hash)                 as visitors,
      count(*) filter (where kind = 'call')        as calls,
      count(*) filter (where kind = 'directions')  as directions,
      count(*) filter (where kind = 'booking')     as bookings,
      count(*) filter (where kind = 'contact')     as contacts,
      count(*) filter (where kind = 'view' and device = 'mobile') as mobile
    from page_events
    where tenant_id = ${tenantId}
      and created_at >= ${start}::date
      and created_at < (${start}::date + interval '1 month')
  `;

  const referrers = await sql<Array<{ referrer: string; count: string }>>`
    select referrer, count(*) as count
    from page_events
    where tenant_id = ${tenantId}
      and kind = 'view'
      and referrer is not null
      and created_at >= ${start}::date
      and created_at < (${start}::date + interval '1 month')
    group by referrer
    order by count desc
    limit 5
  `;

  const views = Number(totals?.views ?? 0);

  return {
    views,
    visitors: Number(totals?.visitors ?? 0),
    calls: Number(totals?.calls ?? 0),
    directions: Number(totals?.directions ?? 0),
    bookings: Number(totals?.bookings ?? 0),
    contacts: Number(totals?.contacts ?? 0),
    mobileShare: views === 0 ? 0 : Math.round((Number(totals?.mobile ?? 0) / views) * 100),
    topReferrers: referrers.map((r) => ({ referrer: r.referrer, count: Number(r.count) })),
  };
}

/**
 * Message prêt à envoyer au commerçant.
 *
 * C'est la pièce qui compte : le rapport mensuel est la meilleure défense
 * contre la résiliation, parce qu'il rend visible ce que le client paie. Un
 * tableau de bord qu'il n'ouvrira jamais n'a pas cet effet.
 */
/** Accord au pluriel. Le message part chez un client : « 1 demandes » se voit. */
function plural(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

export function reportText(
  businessName: string,
  monthLabel: string,
  s: MonthlySummary,
): string {
  const lines = [
    `Bonjour,`,
    ``,
    `Voici le résumé de ${monthLabel} pour le site de ${businessName} :`,
    ``,
    `• ${plural(s.visitors, "visiteur")}, ${plural(s.views, "page consultée", "pages consultées")}`,
    `• ${s.mobileShare} % des visites depuis un téléphone`,
  ];

  if (s.calls > 0) {
    lines.push(`• ${plural(s.calls, "clic")} sur le numéro de téléphone`);
  }
  if (s.directions > 0) {
    lines.push(`• ${plural(s.directions, "demande")} d'itinéraire`);
  }
  if (s.bookings > 0) {
    lines.push(`• ${plural(s.bookings, "demande")} de rendez-vous`);
  }
  if (s.contacts > 0) {
    lines.push(`• ${plural(s.contacts, "message")} via le formulaire`);
  }

  if (s.topReferrers.length > 0) {
    lines.push(``, `Principales provenances : ${s.topReferrers
      .map((r) => `${r.referrer} (${r.count})`)
      .join(", ")}.`);
  }

  lines.push(
    ``,
    `Bonne journée,`,
  );

  return lines.join("\n");
}
