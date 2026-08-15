import type { Sql } from "postgres";

/**
 * Abonnements Stripe.
 *
 * Pourquoi Stripe plutôt qu'une domiciliation bancaire : le mandat SEPA est
 * porté par Stripe, qui est le créancier. Il n'y a donc ni contrat créancier à
 * ouvrir auprès d'une banque, ni identifiant créancier, ni frais fixes
 * mensuels, ni volume minimum — les trois raisons qui rendent la domiciliation
 * classique inaccessible à un indépendant qui démarre.
 *
 * Le commerçant signe son mandat une fois, en ligne, et le prélèvement tourne
 * seul ensuite. C'est exactement le comportement recherché : la rente ne doit
 * pas dépendre d'une relance mensuelle.
 */

/** Statuts Stripe qui nous intéressent, ramenés à ce qu'ils veulent dire ici. */
export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export interface SubscriptionRow {
  tenant_id: string;
  slug: string;
  business_name: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  plan: string | null;
  amount_cents: number | null;
  current_period_end: string | null;
  last_payment_failed_at: string | null;
}

/**
 * Un abonnement mérite-t-il une action de notre part ?
 *
 * `past_due` et `unpaid` signifient que le prélèvement a échoué et que Stripe
 * a épuisé ses relances : c'est le moment de suspendre le site, pas avant.
 * Suspendre au premier échec ferait tomber le site d'un client dont la carte a
 * simplement expiré.
 */
export function needsAttention(status: SubscriptionStatus): boolean {
  return status === "past_due" || status === "unpaid" || status === "canceled";
}

export function statusLabel(status: SubscriptionStatus): string {
  return {
    incomplete: "en attente de signature",
    trialing: "période d'essai",
    active: "à jour",
    past_due: "impayé",
    canceled: "résilié",
    unpaid: "impayé, relances épuisées",
  }[status];
}

export function formatAmount(cents: number | null): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export async function listSubscriptions(sql: Sql): Promise<SubscriptionRow[]> {
  return sql<SubscriptionRow[]>`
    select s.tenant_id, t.slug, t.business_name, s.stripe_customer_id,
           s.stripe_subscription_id, s.status, s.plan, s.amount_cents,
           s.current_period_end, s.last_payment_failed_at
    from subscriptions s
    join tenants t on t.id = s.tenant_id
    order by
      case when s.status in ('past_due', 'unpaid', 'canceled') then 0 else 1 end,
      t.slug
  `;
}

export async function upsertSubscription(
  sql: Sql,
  row: {
    tenantId: string;
    customerId: string;
    subscriptionId?: string | null;
    status: SubscriptionStatus;
    plan?: string | null;
    amountCents?: number | null;
    currentPeriodEnd?: Date | null;
    paymentFailed?: boolean;
  },
): Promise<void> {
  await sql`
    insert into subscriptions (
      tenant_id, stripe_customer_id, stripe_subscription_id, status, plan,
      amount_cents, current_period_end, last_payment_failed_at, updated_at
    ) values (
      ${row.tenantId}, ${row.customerId}, ${row.subscriptionId ?? null},
      ${row.status}, ${row.plan ?? null}, ${row.amountCents ?? null},
      ${row.currentPeriodEnd ?? null},
      ${row.paymentFailed ? new Date() : null}, now()
    )
    on conflict (tenant_id) do update set
      stripe_customer_id     = excluded.stripe_customer_id,
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, subscriptions.stripe_subscription_id),
      status                 = excluded.status,
      plan                   = coalesce(excluded.plan, subscriptions.plan),
      amount_cents           = coalesce(excluded.amount_cents, subscriptions.amount_cents),
      current_period_end     = coalesce(excluded.current_period_end, subscriptions.current_period_end),
      -- Un paiement réussi efface l'échec précédent ; sinon la marque
      -- resterait et le site paraîtrait à suspendre indéfiniment.
      last_payment_failed_at = case
        when ${row.paymentFailed ?? false} then now()
        when excluded.status = 'active' then null
        else subscriptions.last_payment_failed_at
      end,
      updated_at             = now()
  `;
}

export async function findTenantByCustomer(
  sql: Sql,
  customerId: string,
): Promise<{ tenant_id: string } | undefined> {
  const rows = await sql<{ tenant_id: string }[]>`
    select tenant_id from subscriptions where stripe_customer_id = ${customerId}
  `;
  return rows[0];
}
