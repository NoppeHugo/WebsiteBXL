import type { Sql } from "postgres";
import {
  availableSlots,
  isClosed,
  weekdayOf,
  brusselsOffset,
  type Slot,
} from "./availability.ts";

/**
 * Agenda temps réel : lecture des disponibilités et prise de rendez-vous.
 *
 * La règle qui gouverne tout : le calcul propose, la base dispose. Deux
 * personnes peuvent voir le même créneau libre au même instant ; c'est la
 * contrainte d'exclusion qui tranche à l'écriture, et l'une des deux reçoit un
 * refus propre plutôt qu'une double réservation.
 */

export interface DayAvailability {
  day: string;
  closed: boolean;
  slots: string[];
}

interface ServiceRow {
  service_id: string;
  name: string;
  duration_min: number;
}

export async function findService(
  sql: Sql,
  tenantId: string,
  serviceId: string,
): Promise<ServiceRow | undefined> {
  const rows = await sql<ServiceRow[]>`
    select service_id, name, duration_min
    from tenant_services
    where tenant_id = ${tenantId} and service_id = ${serviceId}
  `;
  return rows[0];
}

export async function dayAvailability(
  sql: Sql,
  tenantId: string,
  serviceId: string,
  day: string,
  now = new Date(),
): Promise<DayAvailability> {
  const service = await findService(sql, tenantId, serviceId);
  if (!service) return { day, closed: true, slots: [] };

  const closures = await sql<Array<{ from_day: string; to_day: string }>>`
    select from_day, to_day from tenant_closures where tenant_id = ${tenantId}
  `;
  if (isClosed(day, closures.map((c) => ({ from: String(c.from_day).slice(0, 10), to: String(c.to_day).slice(0, 10) })))) {
    return { day, closed: true, slots: [] };
  }

  const hours = await sql<Array<{ opens: string; closes: string }>>`
    select opens, closes from tenant_hours
    where tenant_id = ${tenantId} and weekday = ${weekdayOf(day)}
    order by opens
  `;
  if (hours.length === 0) return { day, closed: true, slots: [] };

  const [counted] = await sql<Array<{ count: string }>>`
    select count(*) as count from resources
    where tenant_id = ${tenantId} and active
  `;
  const count = counted?.count ?? "0";

  const busy = await sql<Array<{ starts: Date; ends: Date }>>`
    select lower(during) as starts, upper(during) as ends
    from appointments
    where tenant_id = ${tenantId}
      and status <> 'cancelled'
      and during && tstzrange(${`${day} 00:00:00`}::timestamptz - interval '1 day',
                              ${`${day} 00:00:00`}::timestamptz + interval '2 days')
  `;

  const slots = availableSlots({
    day,
    hours: hours.map((h) => ({
      opens: String(h.opens).slice(0, 5),
      closes: String(h.closes).slice(0, 5),
    })),
    busy: busy.map((b) => ({ start: new Date(b.starts), end: new Date(b.ends) })),
    resources: Number(count),
    durationMin: service.duration_min,
    now,
    offsetMin: brusselsOffset(day),
  });

  return { day, closed: false, slots: slots.map((s: Slot) => s.start.toISOString()) };
}

export type BookOutcome =
  | {
      ok: true;
      id: string;
      resource: string;
      serviceName: string;
      endsAt: Date;
      cancelToken: string;
    }
  | { ok: false; reason: "unknown_service" | "no_resource" | "taken" | "closed" };

/**
 * Enregistre un rendez-vous sur la première personne libre.
 *
 * Chaque tentative est une transaction distincte : la contrainte d'exclusion
 * fait échouer celle qui perd la course, et on passe simplement à la ressource
 * suivante. C'est plus simple et plus sûr qu'un verrou posé à la main, et ça
 * s'appuie sur la seule garantie qui tienne réellement — celle de la base.
 */
export async function bookAppointment(
  sql: Sql,
  input: {
    tenantId: string;
    serviceId: string;
    startsAt: Date;
    name: string;
    email: string;
    phone?: string;
    note?: string;
    locale: string;
  },
  now = new Date(),
): Promise<BookOutcome> {
  const service = await findService(sql, input.tenantId, input.serviceId);
  if (!service) return { ok: false, reason: "unknown_service" };

  const day = new Date(input.startsAt.getTime()).toISOString().slice(0, 10);

  // On revalide la disponibilité côté serveur : le créneau proposé peut dater
  // de plusieurs minutes, et rien n'oblige un client à passer par la page.
  const availability = await dayAvailability(
    sql,
    input.tenantId,
    input.serviceId,
    day,
    now,
  );
  if (availability.closed) return { ok: false, reason: "closed" };
  if (!availability.slots.includes(input.startsAt.toISOString())) {
    return { ok: false, reason: "taken" };
  }

  const resources = await sql<Array<{ id: string; name: string }>>`
    select id, name from resources
    where tenant_id = ${input.tenantId} and active
    order by id
  `;
  if (resources.length === 0) return { ok: false, reason: "no_resource" };

  const endsAt = new Date(input.startsAt.getTime() + service.duration_min * 60_000);

  for (const resource of resources) {
    try {
      const [row] = await sql<Array<{ id: string; cancel_token: string }>>`
        insert into appointments (
          tenant_id, resource_id, service_id, service_name, during,
          customer_name, customer_email, customer_phone, note, locale
        ) values (
          ${input.tenantId}, ${resource.id}, ${service.service_id}, ${service.name},
          tstzrange(${input.startsAt}, ${endsAt}, '[)'),
          ${input.name}, ${input.email}, ${input.phone ?? null},
          ${input.note ?? null}, ${input.locale}
        )
        returning id, cancel_token
      `;
      return {
        ok: true,
        id: row!.id,
        resource: resource.name,
        serviceName: service.name,
        endsAt,
        cancelToken: row!.cancel_token,
      };
    } catch (error) {
      // 23P01 : violation de la contrainte d'exclusion — cette personne est
      // prise. On tente la suivante ; toute autre erreur remonte.
      if ((error as { code?: string }).code !== "23P01") throw error;
    }
  }

  return { ok: false, reason: "taken" };
}

/* -------------------------------------------------------------------------- */
/* Annulation                                                                 */
/* -------------------------------------------------------------------------- */

export interface AppointmentView {
  id: string;
  business_name: string;
  service_name: string;
  starts_at: string;
  status: string;
  customer_name: string;
  locale: string;
}

/**
 * Retrouve un rendez-vous par son jeton d'annulation.
 *
 * Le jeton tient lieu d'authentification : le connaître prouve qu'on a reçu le
 * courriel de confirmation. Il n'expose donc que ce que ce courriel contenait
 * déjà, et jamais l'adresse ni le téléphone du client.
 */
export async function findByCancelToken(
  sql: Sql,
  token: string,
): Promise<AppointmentView | undefined> {
  const rows = await sql<AppointmentView[]>`
    select a.id, t.business_name, a.service_name,
           lower(a.during) as starts_at, a.status, a.customer_name, a.locale
    from appointments a
    join tenants t on t.id = a.tenant_id
    where a.cancel_token = ${token}
  `;
  return rows[0];
}

export type CancelOutcome = "cancelled" | "already" | "too_late" | "unknown";

/**
 * Annule un rendez-vous.
 *
 * Refusé une fois l'heure passée : laisser annuler après coup effacerait
 * l'absence des statistiques du salon, alors que c'est précisément ce qu'il a
 * besoin de voir.
 */
export async function cancelByToken(
  sql: Sql,
  token: string,
  now = new Date(),
): Promise<CancelOutcome> {
  const appointment = await findByCancelToken(sql, token);
  if (!appointment) return "unknown";
  if (appointment.status === "cancelled") return "already";
  if (new Date(appointment.starts_at) <= now) return "too_late";

  await sql`
    update appointments set status = 'cancelled' where cancel_token = ${token}
  `;
  return "cancelled";
}
