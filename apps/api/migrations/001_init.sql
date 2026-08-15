-- Schéma initial de l'API.
--
-- Le contenu des sites vit dans git ; cette base ne stocke que le
-- transactionnel : demandes de rendez-vous et messages de contact. Chaque
-- outil à sa place (README §3.6).

create table if not exists tenants (
    id              uuid primary key,
    slug            text        not null unique,
    business_name   text        not null,
    notify_email    text        not null,
    -- Origine autorisée à appeler l'API, ex. https://salon-marie.be
    origin          text        not null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create table if not exists booking_requests (
    id               bigserial   primary key,
    tenant_id        uuid        not null references tenants (id) on delete cascade,
    service_id       text        not null,
    -- Le libellé est figé à la demande : si le salon renomme sa prestation
    -- plus tard, la demande doit rester lisible telle qu'elle a été faite.
    service_name     text        not null,
    preferred_date   date        not null,
    preferred_period text        not null
        check (preferred_period in ('morning', 'afternoon', 'evening')),
    customer_name    text        not null,
    customer_email   text        not null,
    customer_phone   text,
    note             text,
    locale           text        not null,
    status           text        not null default 'new'
        check (status in ('new', 'confirmed', 'declined', 'cancelled')),
    created_at       timestamptz not null default now()
);

create index if not exists booking_requests_tenant_date_idx
    on booking_requests (tenant_id, preferred_date desc);

create table if not exists contact_messages (
    id             bigserial   primary key,
    tenant_id      uuid        not null references tenants (id) on delete cascade,
    customer_name  text        not null,
    customer_email text        not null,
    message        text        not null,
    locale         text        not null,
    created_at     timestamptz not null default now()
);

create index if not exists contact_messages_tenant_idx
    on contact_messages (tenant_id, created_at desc);
