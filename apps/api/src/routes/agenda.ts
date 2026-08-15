import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Language } from "@bxl/schema";
import { sql, findTenant } from "../db.ts";
import {
  dayAvailability,
  bookAppointment,
  findByCancelToken,
  cancelByToken,
} from "../agenda.ts";
import { cancelUrl } from "../reminders.ts";
import { sendMail } from "../mail.ts";
import { ok, rejected, returnTo } from "../respond.ts";

const IsoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const AvailabilityQuery = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().min(1).max(80),
  day: IsoDay,
  /**
   * Nombre de jours renvoyés à partir de `day`.
   *
   * Une seule requête pour toute la quinzaine : la bande de dates peut alors
   * afficher d'emblée les jours fermés ou complets, et passer d'un jour à
   * l'autre devient instantané. Interroger jour par jour ferait clignoter une
   * attente à chaque clic.
   */
  days: z.coerce.number().int().min(1).max(31).optional(),
});

const BookInput = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().min(1).max(80),
  startsAt: z.string().datetime(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  locale: Language.default("fr"),
  consent: z.union([z.literal("on"), z.literal("true"), z.boolean()]),
  _company: z.string().max(200).optional(),
  redirectTo: z.string().url().max(300).optional().or(z.literal("")),
});

const CONFIRMATION: Record<
  string,
  (business: string, when: string, service: string, cancel: string) => string
> = {
  fr: (b, w, s, c) => `Bonjour,\n\nVotre rendez-vous chez ${b} est confirmé :\n${s}, ${w}.\n\nUn empêchement ? Annulez en un clic, le créneau repartira à quelqu'un d'autre :\n${c}\n\nÀ bientôt.`,
  nl: (b, w, s, c) => `Beste,\n\nUw afspraak bij ${b} is bevestigd:\n${s}, ${w}.\n\nVerhinderd? Annuleer met één klik, dan komt het tijdstip weer vrij:\n${c}\n\nTot binnenkort.`,
  en: (b, w, s, c) => `Hello,\n\nYour appointment at ${b} is confirmed:\n${s}, ${w}.\n\nCan't make it? Cancel in one click and the slot goes back to someone else:\n${c}\n\nSee you soon.`,
};

function formatWhen(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-BE`, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  }).format(date);
}

export function agendaRoutes(app: FastifyInstance): void {
  /** Créneaux d'un jour. Public : la page du salon l'appelle à chaque clic. */
  app.get("/v1/availability", {
    config: { rateLimit: { max: 120, timeWindow: "10 minutes" } },
    handler: async (request, reply) => {
      const parsed = AvailabilityQuery.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: "requête invalide" });

      const tenant = await findTenant(parsed.data.tenantId);
      if (!tenant) return reply.code(404).send({ error: "commerce inconnu" });

      const { serviceId, day, days } = parsed.data;

      if (!days) {
        return reply.send(
          await dayAvailability(sql, tenant.id, serviceId, day),
        );
      }

      const start = new Date(`${day}T12:00:00Z`);
      const results = [];
      for (let i = 0; i < days; i += 1) {
        const current = new Date(start.getTime() + i * 86_400_000)
          .toISOString()
          .slice(0, 10);
        results.push(await dayAvailability(sql, tenant.id, serviceId, current));
      }
      return reply.send({ days: results });
    },
  });

  /*
   * Consultation d'un rendez-vous par son jeton. La page d'annulation du site
   * du salon s'en sert pour afficher ce qui va être annulé — annuler à
   * l'aveugle est le meilleur moyen de supprimer le mauvais rendez-vous.
   */
  app.get<{ Querystring: { token?: string } }>("/v1/appointments/lookup", {
    config: { rateLimit: { max: 60, timeWindow: "10 minutes" } },
    handler: async (request, reply) => {
      const token = request.query.token;
      if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
        return reply.code(400).send({ error: "jeton invalide" });
      }

      const appointment = await findByCancelToken(sql, token);
      if (!appointment) return reply.code(404).send({ error: "introuvable" });

      return reply.send({
        business: appointment.business_name,
        service: appointment.service_name,
        startsAt: appointment.starts_at,
        status: appointment.status,
        name: appointment.customer_name,
      });
    },
  });

  app.post<{ Body: { token?: string } }>("/v1/appointments/cancel", {
    config: { rateLimit: { max: 30, timeWindow: "10 minutes" } },
    handler: async (request, reply) => {
      const token = request.body?.token;
      if (!token) return reply.code(400).send({ ok: false, reason: "unknown" });

      const outcome = await cancelByToken(sql, token);
      if (outcome !== "cancelled") {
        return reply.code(409).send({ ok: false, reason: outcome });
      }

      // Le salon doit l'apprendre : c'est un créneau qu'il peut revendre.
      const appointment = await findByCancelToken(sql, token);
      const tenantRow = await sql<Array<{ notify_email: string; business_name: string }>>`
        select t.notify_email, t.business_name
        from appointments a join tenants t on t.id = a.tenant_id
        where a.cancel_token = ${token}
      `;
      const tenant = tenantRow[0];

      if (appointment && tenant) {
        try {
          await sendMail({
            to: tenant.notify_email,
            subject: `Annulation — ${appointment.customer_name}`,
            text: [
              `${appointment.customer_name} a annulé son rendez-vous.`,
              "",
              `Quand : ${formatWhen(new Date(appointment.starts_at), "fr")}`,
              `Prestation : ${appointment.service_name}`,
              "",
              "Le créneau est de nouveau disponible à la réservation.",
            ].join("\n"),
          });
        } catch (error) {
          request.log.warn({ err: error }, "annulation non transmise au salon");
        }
      }

      return reply.send({ ok: true });
    },
  });

  app.post("/v1/appointments", async (request, reply) => {
    const parsed = BookInput.safeParse(request.body);
    if (!parsed.success) return rejected(request, reply, 400, "requête invalide");

    const input = parsed.data;
    if (input._company) return ok(request, reply, undefined);

    const tenant = await findTenant(input.tenantId);
    if (!tenant) return rejected(request, reply, 404, "commerce inconnu");

    const redirectTo = returnTo(request, input.redirectTo, tenant.origin);

    const result = await bookAppointment(sql, {
      tenantId: tenant.id,
      serviceId: input.serviceId,
      startsAt: new Date(input.startsAt),
      name: input.name,
      email: input.email,
      phone: input.phone || undefined,
      note: input.note || undefined,
      locale: input.locale,
    });

    if (!result.ok) {
      /*
       * « taken » n'est pas une erreur du client : quelqu'un a simplement
       * réservé avant lui pendant qu'il remplissait le formulaire. Le message
       * doit l'inviter à choisir un autre créneau, pas suggérer une panne.
       */
      const message =
        result.reason === "taken"
          ? "ce créneau vient d'être pris"
          : result.reason === "closed"
            ? "le salon est fermé ce jour-là"
            : "réservation impossible";
      return rejected(request, reply, 409, message, redirectTo);
    }

    const when = formatWhen(new Date(input.startsAt), input.locale);

    // Le rendez-vous est déjà en base : un échec d'envoi ne doit ni l'annuler
    // ni renvoyer une erreur au client final.
    try {
      await sendMail({
        to: tenant.notify_email,
        replyTo: input.email,
        subject: `Rendez-vous confirmé — ${input.name}, ${when}`,
        text: [
          `Nouveau rendez-vous pour ${tenant.business_name}.`,
          "",
          `Quand : ${when}`,
          `Avec : ${result.resource}`,
          `Prestation : ${result.serviceName}`,
          "",
          `Nom : ${input.name}`,
          `E-mail : ${input.email}`,
          input.phone ? `Téléphone : ${input.phone}` : null,
          input.note ? `\nMessage :\n${input.note}` : null,
        ]
          .filter((line) => line !== null)
          .join("\n"),
      });
    } catch (error) {
      request.log.error({ err: error, appointmentId: result.id }, "rendez-vous non transmis au salon");
    }

    try {
      await sendMail({
        to: input.email,
        replyTo: tenant.notify_email,
        subject: `${tenant.business_name} — rendez-vous confirmé`,
        text: (CONFIRMATION[input.locale] ?? CONFIRMATION.fr!)(
          tenant.business_name,
          when,
          result.serviceName,
          cancelUrl(tenant.origin, result.cancelToken, input.locale),
        ),
      });
    } catch (error) {
      request.log.warn({ err: error }, "confirmation non envoyée au client");
    }

    return ok(request, reply, redirectTo);
  });
}
