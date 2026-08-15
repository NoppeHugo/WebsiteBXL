-- Mesure d'audience, première partie.
--
-- Choix : collecte maison plutôt qu'Umami auto-hébergé. Ce qui a de la valeur
-- ici n'est pas un tableau de bord, c'est le rapport mensuel envoyé au
-- commerçant — et surtout les événements qui le convainquent : clics sur
-- l'itinéraire, appels, demandes de rendez-vous. Un service de plus à
-- maintenir pour un tableau de bord rarement ouvert coûte plus qu'il ne
-- rapporte, alors que la base et l'API existent déjà.
--
-- Aucune adresse IP n'est stockée. L'identification d'un visiteur repose sur
-- une empreinte qui change chaque jour : elle permet de compter des visiteurs
-- uniques sur une journée, et devient inutilisable le lendemain. Pas de
-- cookie, donc pas de bandeau de consentement — et un design qui reste propre.

create table if not exists page_events (
    id           bigserial   primary key,
    tenant_id    uuid        not null references tenants (id) on delete cascade,
    kind         text        not null
        check (kind in ('view', 'call', 'directions', 'booking', 'contact', 'social')),
    path         text        not null,
    lang         text        not null,
    -- Domaine de provenance uniquement : « google.com », jamais l'URL complète,
    -- qui pourrait contenir une recherche nominative.
    referrer     text,
    device       text        not null check (device in ('mobile', 'desktop')),
    -- Empreinte quotidienne du visiteur, non réversible.
    visitor_hash text        not null,
    created_at   timestamptz not null default now()
);

create index if not exists page_events_tenant_time_idx
    on page_events (tenant_id, created_at desc);

create index if not exists page_events_visitor_idx
    on page_events (tenant_id, visitor_hash, created_at);

-- Sel du jour, régénéré quotidiennement. Sans lui, une même empreinte
-- suivrait un visiteur d'un mois à l'autre.
create table if not exists visitor_salts (
    day  date primary key,
    salt text not null
);
