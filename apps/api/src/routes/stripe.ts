import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { config } from "../config.ts";
import { sql } from "../db.ts";
import {
  upsertSubscription,
  findTenantByCustomer,
  type SubscriptionStatus,
} from "../billing.ts";

/**
 * Notifications Stripe.
 *
 * Elles sont la seule source de vérité sur l'état d'un abonnement : nous ne
 * décidons jamais qu'un client est à jour, Stripe nous le dit. Interroger
 * l'API à la demande donnerait une photo, pas un signal — et l'important est
 * précisément d'être prévenu quand un prélèvement échoue.
 */
export function stripeRoutes(app: FastifyInstance): void {
  if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
    app.log.info("Stripe non configuré : les abonnements sont désactivés");
    return;
  }

  const stripe = new Stripe(config.STRIPE_SECRET_KEY);

  app.post(
    "/v1/stripe/webhook",
    {
      config: { rateLimit: false },
      bodyLimit: 1024 * 1024,
    },
    async (request, reply) => {
      const signature = request.headers["stripe-signature"];
      const raw = request.rawBody;

      if (!signature || !raw) return reply.code(400).send("signature absente");

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          raw,
          String(signature),
          config.STRIPE_WEBHOOK_SECRET!,
        );
      } catch (error) {
        // Sans cette vérification, n'importe qui pourrait déclarer un client
        // à jour de paiement en envoyant une requête bien formée.
        request.log.warn({ err: error }, "notification Stripe non authentifiée");
        return reply.code(400).send("signature invalide");
      }

      try {
        await handleEvent(event);
      } catch (error) {
        // Un échec de traitement doit renvoyer une erreur : Stripe réessaiera,
        // au lieu de considérer l'événement comme reçu et de le perdre.
        request.log.error({ err: error, type: event.type }, "événement Stripe non traité");
        return reply.code(500).send("erreur de traitement");
      }

      return reply.code(200).send({ received: true });
    },
  );

  async function handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const tenantId = session.metadata?.tenantId;
        const customerId = String(session.customer ?? "");
        if (!tenantId || !customerId) return;

        await upsertSubscription(sql, {
          tenantId,
          customerId,
          subscriptionId: session.subscription ? String(session.subscription) : null,
          status: "active",
          plan: session.metadata?.plan ?? null,
        });
        return;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = String(subscription.customer);
        const tenant = await findTenantByCustomer(sql, customerId);
        if (!tenant) return;

        const item = subscription.items.data[0];

        await upsertSubscription(sql, {
          tenantId: tenant.tenant_id,
          customerId,
          subscriptionId: subscription.id,
          status:
            event.type === "customer.subscription.deleted"
              ? "canceled"
              : (subscription.status as SubscriptionStatus),
          amountCents: item?.price.unit_amount ?? null,
          plan: subscription.metadata?.plan ?? null,
          currentPeriodEnd: item?.current_period_end
            ? new Date(item.current_period_end * 1000)
            : null,
        });
        return;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const tenant = await findTenantByCustomer(sql, String(invoice.customer));
        if (!tenant) return;

        await upsertSubscription(sql, {
          tenantId: tenant.tenant_id,
          customerId: String(invoice.customer),
          status: "past_due",
          paymentFailed: true,
        });
        return;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const tenant = await findTenantByCustomer(sql, String(invoice.customer));
        if (!tenant) return;

        await upsertSubscription(sql, {
          tenantId: tenant.tenant_id,
          customerId: String(invoice.customer),
          status: "active",
        });
        return;
      }

      default:
        // Les autres événements ne nous concernent pas ; les accepter
        // silencieusement évite que Stripe les réessaie indéfiniment.
        return;
    }
  }
}
