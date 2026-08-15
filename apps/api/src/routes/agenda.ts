import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Language } from "@bxl/schema";
import { sql, findTenant } from "../db.ts";
import { dayAvailability, bookAppointment } from "../agenda.ts";
import { sendMail } from "../mail.ts";
import { ok, rejected, safeRedirect } from "../respond.ts";

const IsoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const AvailabilityQuery = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().min(1).max(80),
  day: IsoDay,
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

const CONFIRMATION: Record<string, (business: string, when: string, service: string) => string> = {
  fr: (b, w, s) => `Bonjour,\n\nVotre rendez-vous chez ${b} est confirmé :\n${s}, ${w}.\n\nSi vous ne pouvez pas venir, prévenez le salon au plus tôt.\n\nÀ bientôt.`,
  nl: (b, w, s) => `Beste,\n\nUw afspraak bij ${b} is bevestigd:\n${s}, ${w}.\n\nKan u niet komen, verwittig de zaak zo snel mogelijk.\n\nTot binnenkort.`,
  en: (b, w, s) => `Hello,\n\nYour appointment at ${b} is confirmed:\n${s}, ${w}.\n\nIf you cannot make it, please let the shop know as early as you can.\n\nSee you soon.`,
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

      const availability = await dayAvailability(
        sql,
        tenant.id,
        parsed.data.serviceId,
        parsed.data.day,
      );
      return reply.send(availability);
    },
  });

  app.post("/v1/appointments", async (request, reply) => {
    const parsed = BookInput.safeParse(request.body);
    if (!parsed.success) return rejected(request, reply, 400, "requête invalide");

    const input = parsed.data;
    if (input._company) return ok(request, reply, undefined);

    const tenant = await findTenant(input.tenantId);
    if (!tenant) return rejected(request, reply, 404, "commerce inconnu");

    const redirectTo = safeRedirect(input.redirectTo, tenant.origin);

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
        ),
      });
    } catch (error) {
      request.log.warn({ err: error }, "confirmation non envoyée au client");
    }

    return ok(request, reply, redirectTo);
  });
}
