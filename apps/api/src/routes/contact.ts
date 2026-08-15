import type { FastifyInstance } from "fastify";
import { ContactMessageInput } from "@bxl/schema/booking";
import { sql, findTenant } from "../db.ts";
import { sendMail } from "../mail.ts";
import { contactToBusiness } from "../templates.ts";
import { ok, rejected, safeRedirect } from "../respond.ts";

export function contactRoutes(app: FastifyInstance): void {
  app.post("/v1/contact", async (request, reply) => {
    const parsed = ContactMessageInput.safeParse(request.body);
    if (!parsed.success) {
      return rejected(request, reply, 400, "requête invalide");
    }

    const input = parsed.data;
    if (input._company) {
      return ok(request, reply, undefined);
    }

    const tenant = await findTenant(input.tenantId);
    if (!tenant) {
      return rejected(request, reply, 404, "commerce inconnu");
    }

    const redirectTo = safeRedirect(input.redirectTo, tenant.origin);

    const [row] = await sql<{ id: string }[]>`
      insert into contact_messages (
        tenant_id, customer_name, customer_email, message, locale
      ) values (
        ${tenant.id}, ${input.name}, ${input.email}, ${input.message},
        ${input.locale}
      )
      returning id
    `;

    const mail = contactToBusiness({
      businessName: tenant.business_name,
      name: input.name,
      email: input.email,
      message: input.message,
    });

    try {
      await sendMail({
        to: tenant.notify_email,
        replyTo: input.email,
        subject: mail.subject,
        text: mail.text,
      });
    } catch (error) {
      request.log.error(
        { err: error, contactMessageId: row?.id, tenant: tenant.slug },
        "message enregistré mais non transmis au commerce",
      );
    }

    return ok(request, reply, redirectTo);
  });
}
