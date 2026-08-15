import type { FastifyInstance } from "fastify";
import { BookingRequestInput, isAcceptableDate } from "@bxl/schema/booking";
import { sql, findTenant } from "../db.ts";
import { sendMail } from "../mail.ts";
import { bookingToBusiness, bookingToCustomer } from "../templates.ts";
import { ok, rejected, safeRedirect } from "../respond.ts";

export function bookingRoutes(app: FastifyInstance): void {
  app.post("/v1/booking-requests", async (request, reply) => {
    const parsed = BookingRequestInput.safeParse(request.body);

    if (!parsed.success) {
      // On ne détaille pas les erreurs de champ : le formulaire les valide
      // déjà côté navigateur, et un message générique n'aide pas un robot.
      return rejected(request, reply, 400, "requête invalide");
    }

    const input = parsed.data;

    // Piège à robots : rempli, on répond comme si tout s'était bien passé,
    // pour ne pas indiquer au robot ce qui l'a trahi.
    if (input._company) {
      return ok(request, reply, safeRedirect(input.redirectTo, "https://x.invalid"));
    }

    const tenant = await findTenant(input.tenantId);
    if (!tenant) {
      return rejected(request, reply, 404, "commerce inconnu");
    }

    const redirectTo = safeRedirect(input.redirectTo, tenant.origin);

    if (!isAcceptableDate(input.preferredDate)) {
      return rejected(request, reply, 400, "date hors limites", redirectTo);
    }

    const serviceName = input.serviceName || input.serviceId;

    const [row] = await sql<{ id: string }[]>`
      insert into booking_requests (
        tenant_id, service_id, service_name, preferred_date, preferred_period,
        customer_name, customer_email, customer_phone, note, locale
      ) values (
        ${tenant.id}, ${input.serviceId}, ${serviceName}, ${input.preferredDate},
        ${input.preferredPeriod}, ${input.name}, ${input.email},
        ${input.phone || null}, ${input.note || null}, ${input.locale}
      )
      returning id
    `;

    const mailData = {
      businessName: tenant.business_name,
      serviceName,
      preferredDate: input.preferredDate,
      preferredPeriod: input.preferredPeriod,
      name: input.name,
      email: input.email,
      phone: input.phone || undefined,
      note: input.note || undefined,
      locale: input.locale,
    };

    /*
     * La demande est déjà enregistrée : un échec d'envoi ne doit pas la perdre
     * ni renvoyer une erreur au client final. On journalise pour pouvoir la
     * rattraper — c'est le chiffre d'affaires du salon qui est en jeu.
     */
    const business = bookingToBusiness(mailData);
    try {
      await sendMail({
        to: tenant.notify_email,
        replyTo: input.email,
        subject: business.subject,
        text: business.text,
      });
    } catch (error) {
      request.log.error(
        { err: error, bookingRequestId: row?.id, tenant: tenant.slug },
        "demande enregistrée mais non transmise au salon",
      );
    }

    const customer = bookingToCustomer(mailData);
    try {
      await sendMail({
        to: input.email,
        replyTo: tenant.notify_email,
        subject: customer.subject,
        text: customer.text,
      });
    } catch (error) {
      request.log.warn(
        { err: error, bookingRequestId: row?.id },
        "accusé de réception non envoyé au client",
      );
    }

    return ok(request, reply, redirectTo);
  });
}
