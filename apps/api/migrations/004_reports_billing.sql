-- Envoi automatique des rapports, et abonnements.

alter table tenants
    add column if not exists report_enabled boolean not null default true,
    -- Langue du commerçant, pour le rapport mensuel qu'il reçoit.
    add column if not exists locale text not null default 'fr'
        check (locale in ('fr', 'nl', 'en'));

-- Trace des rapports envoyés. La clé primaire composée rend l'envoi
-- idempotent : un redémarrage du service ne peut pas envoyer deux fois le
-- même mois au commerçant.
create table if not exists monthly_reports (
    tenant_id uuid        not null references tenants (id) on delete cascade,
    month     text        not null,
    sent_at   timestamptz not null default now(),
    primary key (tenant_id, month)
);

-- Abonnements Stripe.
--
-- Stripe est le créancier du mandat SEPA : c'est ce qui évite d'avoir à
-- ouvrir un contrat de domiciliation auprès d'une banque, avec son
-- identifiant créancier, ses frais et son volume minimum.
create table if not exists subscriptions (
    tenant_id            uuid        primary key references tenants (id) on delete cascade,
    stripe_customer_id   text        not null unique,
    stripe_subscription_id text      unique,
    -- Reflet du statut Stripe, mis à jour par les notifications reçues.
    status               text        not null default 'incomplete',
    plan                 text,
    amount_cents         integer,
    current_period_end   timestamptz,
    -- Dernier échec de paiement non résolu : c'est le signal de suspension.
    last_payment_failed_at timestamptz,
    updated_at           timestamptz not null default now()
);

create index if not exists subscriptions_status_idx on subscriptions (status);
