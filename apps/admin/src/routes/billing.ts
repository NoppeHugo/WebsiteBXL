import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import {
  listSubscriptions,
  statusLabel,
  formatAmount,
  needsAttention,
  upsertSubscription,
} from "@bxl/api/billing";
import { config } from "../config.ts";
import { sql } from "../db.ts";
import { clients, client } from "../repo.ts";
import { layout, flash, escape } from "../views.ts";

/**
 * Suivi des abonnements.
 *
 * Le mensuel est la raison d'être du modèle, donc la question à laquelle cette
 * page doit répondre en un coup d'œil est : « qui n'a pas payé ? ». Les
 * impayés remontent en tête, et le lien de suspension du site est à côté —
 * c'est le seul moyen de pression réellement utile.
 */

/** Paliers du modèle. Les montants doivent correspondre aux prix Stripe. */
const PLANS = [
  { id: "essentiel", label: "Essentiel — 25 €/mois", cents: 2500 },
  { id: "pro", label: "Pro — 39 €/mois", cents: 3900 },
  { id: "signature", label: "Signature — 59 €/mois", cents: 5900 },
] as const;

export function billingRoutes(app: FastifyInstance): void {
  const stripe = config.STRIPE_SECRET_KEY
    ? new Stripe(config.STRIPE_SECRET_KEY)
    : undefined;

  async function page(message?: { kind: "ok" | "error"; text: string }) {
    const rows = await listSubscriptions(sql);
    const subscribed = new Set(rows.map((r) => r.slug));

    const unsubscribed = clients().filter((slug) => {
      if (subscribed.has(slug)) return false;
      try {
        return client(slug).site.status !== "draft";
      } catch {
        return false;
      }
    });

    const table = rows
      .map(
        (row) => `<tr>
      <td><strong>${escape(row.business_name)}</strong>
        <div class="muted">${escape(row.slug)}</div></td>
      <td>${escape(statusLabel(row.status))}
        ${
          needsAttention(row.status)
            ? `<div class="muted">depuis ${
                row.last_payment_failed_at
                  ? escape(String(row.last_payment_failed_at).slice(0, 10))
                  : "—"
              }</div>`
            : ""
        }</td>
      <td>${escape(formatAmount(row.amount_cents))}</td>
      <td>${escape(row.current_period_end ? String(row.current_period_end).slice(0, 10) : "—")}</td>
      <td>
        ${
          needsAttention(row.status)
            ? `<a href="/clients/${escape(row.slug)}">Suspendre le site →</a>`
            : ""
        }
      </td>
    </tr>`,
      )
      .join("");

    return layout(
      "Abonnements",
      `<h1>Abonnements</h1>
${message ? flash(message.kind, message.text) : ""}
${
  stripe
    ? ""
    : flash(
        "error",
        "Stripe n'est pas configuré : renseignez STRIPE_SECRET_KEY pour créer des mandats.",
      )
}

${
  rows.length > 0
    ? `<table>
  <thead><tr><th>Commerce</th><th>État</th><th>Montant</th><th>Prochaine échéance</th><th></th></tr></thead>
  <tbody>${table}</tbody>
</table>`
    : `<p class="muted">Aucun abonnement enregistré.</p>`
}

${
  stripe && unsubscribed.length > 0
    ? `<h2>Mettre en place un abonnement</h2>
<p class="muted">
  Génère un lien à envoyer au commerçant. Il y signe son mandat de prélèvement
  une seule fois ; les mois suivants tombent seuls.
</p>
<form method="post" action="/billing/checkout">
  <div class="row">
    <label>Commerce
      <select name="slug" required>
        ${unsubscribed.map((s) => `<option value="${escape(s)}">${escape(s)}</option>`).join("")}
      </select>
    </label>
    <label>Palier
      <select name="plan" required>
        ${PLANS.map((p) => `<option value="${p.id}">${escape(p.label)}</option>`).join("")}
      </select>
    </label>
  </div>
  <div class="actions"><button type="submit">Créer le lien de mandat</button></div>
</form>`
    : ""
}`,
      { authenticated: true },
    );
  }

  app.get("/billing", async (_request, reply) =>
    reply.type("text/html").send(await page()),
  );

  app.post<{ Body: { slug?: string; plan?: string } }>(
    "/billing/checkout",
    async (request, reply) => {
      if (!stripe) {
        return reply.code(400).type("text/html").send(
          await page({ kind: "error", text: "Stripe n'est pas configuré." }),
        );
      }

      const { slug, plan } = request.body ?? {};
      const chosen = PLANS.find((p) => p.id === plan);
      if (!slug || !chosen) {
        return reply.code(400).type("text/html").send(
          await page({ kind: "error", text: "commerce ou palier manquant" }),
        );
      }

      const { site } = client(slug);
      if (!site.tenantId) {
        return reply.code(400).type("text/html").send(
          await page({
            kind: "error",
            text: `${slug} n'est pas enregistré auprès de l'API. Lancez d'abord pnpm tenant ${slug}.`,
          }),
        );
      }

      try {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          /*
           * Prélèvement SEPA d'abord, carte en secours. Le prélèvement coûte
           * moins cher et n'expire pas — une carte qui expire au bout de trois
           * ans casse la rente sans prévenir.
           */
          payment_method_types: ["sepa_debit", "card"],
          customer_email: site.business.email,
          line_items: [
            {
              price_data: {
                currency: "eur",
                unit_amount: chosen.cents,
                recurring: { interval: "month" },
                product_data: {
                  name: `Site web et maintenance — ${site.business.name}`,
                },
              },
              quantity: 1,
            },
          ],
          // Le lien entre le paiement et le commerce voyage dans les
          // métadonnées : c'est ce que les notifications nous renverront.
          metadata: { tenantId: site.tenantId, slug, plan: chosen.id },
          subscription_data: {
            metadata: { tenantId: site.tenantId, slug, plan: chosen.id },
          },
          success_url: `${config.PUBLIC_ADMIN_URL || "https://example.invalid"}/billing?ok=1`,
          cancel_url: `${config.PUBLIC_ADMIN_URL || "https://example.invalid"}/billing?ok=0`,
        });

        if (session.customer) {
          await upsertSubscription(sql, {
            tenantId: site.tenantId,
            customerId: String(session.customer),
            status: "incomplete",
            plan: chosen.id,
            amountCents: chosen.cents,
          });
        }

        return reply.type("text/html").send(
          await page({
            kind: "ok",
            text: `Lien à envoyer à ${site.business.name} : ${session.url}`,
          }),
        );
      } catch (error) {
        return reply.code(500).type("text/html").send(
          await page({
            kind: "error",
            text: `Stripe a refusé : ${(error as Error).message}`,
          }),
        );
      }
    },
  );
}
