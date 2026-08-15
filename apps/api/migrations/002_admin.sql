-- Comptes de la console d'administration.
--
-- Les migrations restent toutes ici : l'API est seule propriétaire du schéma,
-- la console ne fait que lire et écrire. Deux services qui migreraient la même
-- base finiraient par se marcher dessus.

create table if not exists admin_users (
    id            bigserial   primary key,
    email         text        not null unique,
    -- scrypt : fourni par Node lui-même, donc aucune dépendance native à
    -- recompiler à chaque mise à jour de l'image.
    password_hash text        not null,
    -- Secret TOTP en base32. La console peut mettre hors ligne tous les sites
    -- clients : le mot de passe seul ne suffit pas.
    totp_secret   text,
    created_at    timestamptz not null default now(),
    last_login_at timestamptz
);

-- Journal des publications : qui a publié quoi, et quand. Sur un outil qui
-- peut modifier trente sites, savoir ce qui a changé vaut cher le jour où
-- quelque chose casse.
create table if not exists publish_log (
    id         bigserial   primary key,
    admin_id   bigint      references admin_users (id) on delete set null,
    slug       text        not null,
    action     text        not null check (action in ('save', 'publish', 'suspend', 'resume')),
    detail     text,
    created_at timestamptz not null default now()
);

create index if not exists publish_log_slug_idx on publish_log (slug, created_at desc);
