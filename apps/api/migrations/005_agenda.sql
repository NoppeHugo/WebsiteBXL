-- Agenda temps réel (réservation v2).
--
-- Le contenu des clients vit dans git ; l'agenda a besoin des horaires et des
-- prestations à l'exécution. Ils sont donc *projetés* ici à la publication :
-- git reste la source de vérité, la base n'en garde qu'une copie de travail.

-- Nécessaire pour la contrainte d'exclusion ci-dessous : elle mélange une
-- égalité (la ressource) et un chevauchement (l'intervalle).
create extension if not exists btree_gist;

create table if not exists tenant_services (
    tenant_id    uuid    not null references tenants (id) on delete cascade,
    service_id   text    not null,
    name         text    not null,
    duration_min integer not null check (duration_min > 0),
    price_cents  integer,
    primary key (tenant_id, service_id)
);

create table if not exists tenant_hours (
    tenant_id uuid    not null references tenants (id) on delete cascade,
    weekday   integer not null check (weekday between 0 and 6), -- 0 = dimanche
    opens     time    not null,
    closes    time    not null,
    check (opens < closes),
    primary key (tenant_id, weekday, opens)
);

create table if not exists tenant_closures (
    tenant_id uuid not null references tenants (id) on delete cascade,
    from_day  date not null,
    to_day    date not null,
    check (from_day <= to_day),
    primary key (tenant_id, from_day)
);

-- Les personnes qui reçoivent : un salon à trois fauteuils peut prendre trois
-- rendez-vous à la même heure.
create table if not exists resources (
    id         bigserial   primary key,
    tenant_id  uuid        not null references tenants (id) on delete cascade,
    name       text        not null,
    active     boolean     not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_id, name)
);

create table if not exists appointments (
    id             bigserial   primary key,
    tenant_id      uuid        not null references tenants (id) on delete cascade,
    resource_id    bigint      not null references resources (id) on delete cascade,
    service_id     text        not null,
    service_name   text        not null,
    -- Intervalle plutôt que début + durée : c'est lui que la contrainte
    -- d'exclusion compare, et une durée stockée à part pourrait diverger.
    during         tstzrange   not null,
    customer_name  text        not null,
    customer_email text        not null,
    customer_phone text,
    note           text,
    locale         text        not null default 'fr',
    status         text        not null default 'booked'
        check (status in ('booked', 'honoured', 'no_show', 'cancelled')),
    created_at     timestamptz not null default now(),

    /*
     * Le cœur de la fiabilité de l'agenda.
     *
     * Deux personnes qui réservent le même créneau à la même seconde passent
     * toutes deux la vérification applicative — elles ne voient pas encore la
     * ligne de l'autre. Seule la base peut trancher : cette contrainte refuse
     * tout chevauchement sur une même ressource, et la seconde transaction
     * échoue proprement au lieu de créer un double.
     *
     * Un rendez-vous annulé libère son créneau, d'où la condition.
     */
    constraint appointments_no_overlap
        exclude using gist (resource_id with =, during with &&)
        where (status <> 'cancelled')
);

create index if not exists appointments_tenant_time_idx
    on appointments (tenant_id, during);
