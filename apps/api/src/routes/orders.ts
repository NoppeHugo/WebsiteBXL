import type { FastifyInstance } from "fastify";
import { OrderRequestInput, isAcceptableDate } from "@bxl/schema/booking";
import { sql, findTenant } from "../db.ts";
import { sendMail } from "../mail.ts";
import { orderToBusiness } from "../templates.ts";
import { ok, rejected, returnTo } from "../respond.ts";

/**
 * Demande de commande.
 *
 * Même forme que le formulaire de contact — même piège à robots, même
 * vérification d'origine, même refus silencieux — mais elle enregistre une
 * intention d'achat, pas un message.
 *
 * Rien n'est encaissé, rien n'est réservé. Le commerçant rappelle. C'est ce
 * qui distingue cette route d'une boutique en ligne, et c'est un choix : un
 * fleuriste ne peut pas s'engager d'avance sur un bouquet dont il ignore
 * encore ce que l'arrivage du matin lui permettra de composer.
 */
export function orderRoutes(app: FastifyInstance): void {
  app.post("/v1/orders", async (request, reply) => {
    const parsed = OrderRequestInput.safeParse(request.body);
    if (!parsed.success) {
      return rejected(request, reply, 400, "requête invalide");
    }

    const input = parsed.data;
    // Champ piège rempli : on répond comme si tout allait bien. Dire au robot
    // ce qui l'a trahi lui apprendrait à le contourner.
    if (input._company) {
      return ok(request, reply, undefined);
    }

    const tenant = await findTenant(input.tenantId);
    if (!tenant) {
      return rejected(request, reply, 404, "commerce inconnu");
    }

    /*
     * Une adresse est exigée dès qu'il y a livraison. La base le refuse aussi,
     * mais un refus de contrainte donnerait une erreur 500 illisible : mieux
     * vaut le dire ici, où le message peut être compris.
     */
    if (input.mode === "delivery" && !input.address?.trim()) {
      return rejected(request, reply, 400, "adresse de livraison requise");
    }

    /*
     * Une date passée est refusée, un horizon d'un an accepté : c'est le
     * commerçant qui juge de ce qu'il peut tenir, pas le formulaire. Une date
     * vide reste valable — « dès que possible » est une réponse.
     */
    if (input.wantedDate && !isAcceptableDate(input.wantedDate)) {
      return rejected(request, reply, 400, "date impossible");
    }

    const redirectTo = returnTo(request, input.redirectTo, tenant.origin);

    const [row] = await sql<{ id: string }[]>`
      insert into orders (
        tenant_id, occasion_id, occasion_name, budget_cents, wanted_day,
        mode, address, card_message,
        customer_name, customer_email, customer_phone, note, locale
      ) values (
        ${tenant.id},
        ${input.occasionId || null},
        ${input.occasionName || null},
        ${input.budget === undefined ? null : Math.round(input.budget * 100)},
        ${input.wantedDate || null},
        ${input.mode},
        ${input.address?.trim() || null},
        ${input.card?.trim() || null},
        ${input.name}, ${input.email}, ${input.phone || null},
        ${input.note?.trim() || null}, ${input.locale}
      )
      returning id
    `;

    const mail = orderToBusiness({
      businessName: tenant.business_name,
      name: input.name,
      email: input.email,
      phone: input.phone || undefined,
      occasion: input.occasionName || undefined,
      budget: input.budget,
      wantedDate: input.wantedDate || undefined,
      mode: input.mode,
      address: input.address?.trim() || undefined,
      card: input.card?.trim() || undefined,
      note: input.note?.trim() || undefined,
      locale: input.locale,
    });

    try {
      await sendMail({
        to: tenant.notify_email,
        // Répondre au courriel écrit directement au client : c'est le geste
        // que fera le commerçant, et lui demander de recopier l'adresse
        // garantit qu'un jour il se trompera de destinataire.
        replyTo: input.email,
        subject: mail.subject,
        text: mail.text,
      });
    } catch (error) {
      // La commande est enregistrée quoi qu'il arrive : elle reste visible
      // dans l'espace commerçant, même si le courriel n'est pas parti.
      request.log.error(
        { err: error, orderId: row?.id, tenant: tenant.slug },
        "commande enregistrée mais non transmise au commerce",
      );
    }

    return ok(request, reply, redirectTo);
  });
}
