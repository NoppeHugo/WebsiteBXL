-- Accès du commerçant à son propre site.
--
-- Jusqu'ici la console n'avait qu'un utilisateur : l'exploitant, qui voit et
-- modifie les trente sites. Tout changement de contenu passait donc par lui.
-- C'est tenable — et facturable — pour une refonte de textes ; ça ne l'est pas
-- pour « je suis malade, je ferme jeudi », qui est urgent par nature et ne peut
-- pas attendre qu'il soit joignable. Un client devant une porte close, c'est le
-- salon qui prend, et l'exploitant qu'on appelle.
--
-- Une seule colonne suffit à porter la distinction.

alter table admin_users
    -- NULL : l'exploitant, qui voit tous les commerces.
    -- Renseignée : un commerçant, qui ne voit que le sien.
    --
    -- Volontairement l'identifiant du site, et non l'identifiant du commerce
    -- en base : c'est le dépôt git qui fait foi pour le contenu, et c'est
    -- « clients/<slug> » que la console ouvre. Un commerce sans site — donc
    -- sans dossier — n'a rien à éditer.
    add column if not exists tenant_slug text,

    -- Vrai tant que le commerçant n'a pas remplacé le mot de passe qu'on lui a
    -- remis. Un mot de passe transmis par SMS ou dicté au comptoir a été vu par
    -- au moins deux personnes : il ne doit pas rester en place.
    add column if not exists must_change_password boolean not null default false;

create index if not exists admin_users_tenant_idx
    on admin_users (tenant_slug) where tenant_slug is not null;

-- Deux comptes ne peuvent pas se partager un site : le second écraserait les
-- modifications du premier sans le savoir, et l'on ne saurait plus qui a changé
-- quoi. Un salon à plusieurs mains partage un compte, ce qui est aussi ce que
-- font les salons avec leur caisse.
create unique index if not exists admin_users_tenant_unique_idx
    on admin_users (tenant_slug) where tenant_slug is not null;

-- Le journal de publication distingue déjà l'enregistrement de la mise en
-- ligne. Il lui manquait de quoi dire *qui* : `admin_id` y pourvoit déjà, mais
-- rien ne permettait de retrouver les actions d'un commerçant sans jointure.
create index if not exists publish_log_admin_idx
    on publish_log (admin_id, created_at desc);
