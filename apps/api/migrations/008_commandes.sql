-- Demandes de commande, pour les métiers qui ne prennent pas rendez-vous.
--
-- Un fleuriste ne réserve pas un créneau : il reçoit une intention — une
-- occasion, un budget, une date, une adresse — et rappelle pour confirmer.
-- Aucun paiement n'est encaissé ici, et c'est délibéré : ce qu'il pourra
-- composer dépend de l'arrivage du matin, et un montant prélevé d'avance
-- l'engagerait sur un bouquet qu'il n'a pas encore vu.
--
-- Table distincte de `booking_requests` plutôt qu'un élargissement de
-- celle-ci : les deux n'ont en commun que le client et la date. Y ajouter six
-- colonnes nulles pour les salons, et trois pour les fleuristes, aurait donné
-- une table dont aucune ligne n'utilise la moitié des champs — et dont plus
-- personne ne saurait lesquels sont obligatoires pour qui.

create table if not exists orders (
    id            bigserial   primary key,
    tenant_id     uuid        not null references tenants (id) on delete cascade,

    -- Ce que le client demande. `occasion_name` est dénormalisé à côté de son
    -- identifiant, comme `service_name` pour les rendez-vous : la carte des
    -- occasions change au fil des saisons, et une commande de la Toussaint
    -- doit rester lisible en janvier.
    occasion_id   text,
    occasion_name text,
    budget_cents  integer     check (budget_cents is null or budget_cents >= 0),
    wanted_day    date,

    mode          text        not null default 'pickup'
                              check (mode in ('delivery', 'pickup')),
    address       text,
    -- Le mot de la carte. Recopié à la main par le fleuriste : c'est souvent
    -- ce à quoi le client tient le plus.
    card_message  text,

    customer_name  text        not null,
    customer_email text        not null,
    customer_phone text,
    note           text,
    locale         text        not null default 'fr',

    status        text        not null default 'new'
                              check (status in ('new', 'confirmed', 'declined', 'done')),
    created_at    timestamptz not null default now()
);

-- Une adresse est exigée dès qu'il y a livraison : une commande à livrer sans
-- adresse est une commande qu'on ne peut pas honorer, et il vaut mieux que la
-- base le refuse que de le découvrir le matin de la livraison.
alter table orders
    drop constraint if exists orders_adresse_si_livraison;
alter table orders
    add constraint orders_adresse_si_livraison
    check (mode <> 'delivery' or (address is not null and length(btrim(address)) > 0));

create index if not exists orders_tenant_idx on orders (tenant_id, created_at desc);
create index if not exists orders_statut_idx on orders (tenant_id, status, wanted_day);
