-- Demandes de table, pour les restaurants.
--
-- Une demande de table est une commande : une intention datée que le commerce
-- rappelle pour confirmer, rien d'encaissé, rien de réservé d'office. Elle
-- rejoint donc `orders` plutôt que d'ouvrir une table à elle, contrairement au
-- choix fait pour les rendez-vous — ceux-là ne partagent avec une commande que
-- le client et la date, là où une table partage tout sauf deux champs.
--
-- Ces deux champs sont l'heure et le nombre de couverts. L'occasion, le budget
-- et l'adresse de livraison restent vides : ils n'ont pas de sens à table.
--
-- Rien d'automatique n'est promis ici : la disponibilité réelle par service
-- — combien de couverts restent à 20 h un samedi — n'existe pas, et une table
-- confirmée d'office qui n'existe pas coûterait au restaurant le client et
-- l'avis qui suit.

alter table orders
    add column if not exists wanted_time time,
    add column if not exists party_size  integer
        check (party_size is null or (party_size > 0 and party_size <= 200));

-- Le mode admet une troisième valeur. La contrainte est reconstruite plutôt
-- qu'ajoutée : Postgres ne sait pas élargir un `check` en place.
alter table orders
    drop constraint if exists orders_mode_check;
alter table orders
    add constraint orders_mode_check
    check (mode in ('delivery', 'pickup', 'table'));

-- Une table sans heure ni nombre de couverts n'est pas une table : c'est un
-- appel que le restaurant devra passer pour poser les deux questions.
alter table orders
    drop constraint if exists orders_table_complete;
alter table orders
    add constraint orders_table_complete
    check (
        mode <> 'table'
        or (wanted_day is not null and wanted_time is not null and party_size is not null)
    );
