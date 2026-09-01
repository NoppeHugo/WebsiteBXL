-- Les écoles, leurs élèves, leurs exercices et leurs devoirs.
--
-- ─── Pourquoi cette table dans cette base ─────────────────────────────────
--
-- Le catalogue des métiers compte déjà l'école (auto-école, école de langues,
-- école de musique) parmi les commerces à qui l'on vend un site. Un site vend
-- une école ; il ne la fait pas tourner. Ce qui la fait tourner — savoir qui a
-- fait quoi, et donner du travail à celui qui a pris du retard — se passait
-- jusqu'ici dans un tableur partagé, ou nulle part.
--
-- D'où un espace de cours : le responsable ouvre son compte lui-même, invite
-- ses élèves, publie ses exercices et suit leur avancement. C'est une deuxième
-- raison de payer l'abonnement, et la seule que le concurrent qui livre un
-- site à 300 € ne sait pas copier en une soirée.
--
-- ─── Ce qui n'est délibérément pas fait ───────────────────────────────────
--
-- Aucun parcours imposé. Un élève ouvre l'exercice qu'il veut, dans l'ordre
-- qu'il veut, sans devoir terminer les précédents : un adulte qui reprend le
-- code de la route trois soirs par semaine ne suit pas un programme, il
-- révise ce qu'il a raté. Le seul ordre qui compte est celui que le
-- responsable impose explicitement, en posant un devoir.

create table if not exists ecoles (
    id         bigserial   primary key,
    nom        text        not null,
    created_at timestamptz not null default now()
);

-- Le responsable d'une école est un compte de la console, comme le commerçant
-- — même table, même connexion, même cookie. Une troisième pile
-- d'authentification pour un troisième rôle serait une troisième occasion de
-- se tromper sur qui a le droit de voir quoi.
alter table admin_users
    add column if not exists ecole_id bigint references ecoles (id) on delete cascade;

create index if not exists admin_users_ecole_idx
    on admin_users (ecole_id) where ecole_id is not null;

-- Un compte est attaché à un commerce **ou** à une école, jamais aux deux.
-- Sans cette contrainte, un compte portant les deux serait lu comme un
-- commerçant ici et comme un responsable là, selon la fonction qui l'examine.
alter table admin_users
    drop constraint if exists admin_users_un_seul_role;
alter table admin_users
    add constraint admin_users_un_seul_role
    check (tenant_slug is null or ecole_id is null);

/*
 * Les élèves ont leur propre table, et non une colonne de plus sur les comptes
 * de la console.
 *
 * `admin_users` sans `tenant_slug` désigne l'exploitant, celui qui peut mettre
 * hors ligne les trente sites. Un élève rangé là, avec ses colonnes vides,
 * serait lu comme un exploitant par toute fonction qui pose la question de
 * cette façon — et il y en a. Une école de langues compte cent élèves ; cent
 * occasions que cette confusion se produise.
 */
create table if not exists eleves (
    id             bigserial   primary key,
    ecole_id       bigint      not null references ecoles (id) on delete cascade,
    email          text        not null unique,
    prenom         text        not null,
    nom            text        not null default '',
    -- Nul tant que l'invitation n'a pas été acceptée : personne ne choisit le
    -- mot de passe d'un élève à sa place, pas même son professeur.
    password_hash  text,
    invitation     text        unique,
    invitation_fin timestamptz,
    actif_le       timestamptz,
    last_login_at  timestamptz,
    created_at     timestamptz not null default now()
);

create index if not exists eleves_ecole_idx on eleves (ecole_id, prenom, nom);

create table if not exists exercices (
    id         bigserial   primary key,
    ecole_id   bigint      not null references ecoles (id) on delete cascade,
    titre      text        not null,
    -- L'énoncé. Du texte, pas du balisage : ce qui est tapé est ce qui est lu.
    consigne   text        not null default '',
    -- Un lien vers la ressource — une vidéo, un PDF, un test en ligne.
    lien       text,
    -- « Code de la route », « Grammaire », « Solfège » : le mot du métier, tel
    -- que le responsable le dit à ses élèves.
    matiere    text,
    ordre      integer     not null default 0,
    -- Un exercice se prépare avant d'être visible. Sans brouillon, on écrit
    -- l'énoncé directement sous les yeux des élèves.
    publie     boolean     not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists exercices_ecole_idx on exercices (ecole_id, ordre, id);

/*
 * Le travail d'un élève sur un exercice.
 *
 * Absence de ligne = pas commencé. C'est ce qui permet de publier un exercice
 * pour cent élèves sans écrire cent lignes, et de ne rien avoir à rattraper
 * quand un élève arrive en cours d'année.
 */
create table if not exists travaux (
    id           bigserial   primary key,
    eleve_id     bigint      not null references eleves (id) on delete cascade,
    exercice_id  bigint      not null references exercices (id) on delete cascade,
    reponse      text        not null default '',
    statut       text        not null default 'commence'
        check (statut in ('commence', 'rendu')),
    rendu_le     timestamptz,
    -- Ce que le responsable répond. Vide tant qu'il n'a pas corrigé.
    correction   text,
    appreciation text check (appreciation in ('acquis', 'a_revoir')),
    corrige_le   timestamptz,
    updated_at   timestamptz not null default now(),
    unique (eleve_id, exercice_id)
);

create index if not exists travaux_exercice_idx on travaux (exercice_id);
-- Ce que le responsable ouvre le lundi matin : ce qui a été rendu et qui
-- attend une correction.
create index if not exists travaux_a_corriger_idx
    on travaux (eleve_id, rendu_le desc) where statut = 'rendu' and corrige_le is null;

/*
 * Les devoirs : les exercices qu'un élève **doit** faire.
 *
 * C'est la seule contrainte d'ordre du dispositif. Le reste du catalogue lui
 * reste ouvert en permanence ; un devoir dit simplement « celui-ci d'abord, et
 * pour telle date ».
 */
create table if not exists devoirs (
    id          bigserial   primary key,
    eleve_id    bigint      not null references eleves (id) on delete cascade,
    exercice_id bigint      not null references exercices (id) on delete cascade,
    -- Facultative : « à faire avant le prochain cours » n'a pas toujours de
    -- date, et une date obligatoire se remplit alors n'importe comment.
    du_le       date,
    cree_le     timestamptz not null default now(),
    unique (eleve_id, exercice_id)
);

create index if not exists devoirs_eleve_idx on devoirs (eleve_id, du_le);
