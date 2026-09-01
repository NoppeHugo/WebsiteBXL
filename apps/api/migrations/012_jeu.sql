-- Ce qu'il faut retenir pour qu'un élève ait envie de revenir demain.
--
-- ─── Pourquoi une table pour les jours, et rien pour les points ────────────
--
-- Les points, le niveau et les hauts faits se **recalculent** à chaque page à
-- partir des travaux : ils n'ont pas d'existence propre, et une valeur stockée
-- qu'on oublie de mettre à jour finit par contredire ce que l'élève voit juste
-- à côté. Rien à migrer le jour où le barème change, rien à réparer le jour où
-- un professeur supprime un exercice.
--
-- La série de jours, elle, ne se recalcule pas : `travaux.rendu_le` ne garde
-- que la **dernière** remise. Un élève qui reprend un vieil exercice effacerait
-- la trace du jour où il l'avait rendu la première fois — et verrait sa série
-- de douze jours fondre pour avoir travaillé. C'est exactement l'inverse de ce
-- qu'une série doit produire. D'où une ligne par jour travaillé, écrite une
-- fois et jamais réécrite.

create table if not exists jours_actifs (
    eleve_id bigint  not null references eleves (id) on delete cascade,
    -- Date locale belge, et non `current_date` en UTC : un élève qui rend un
    -- exercice à 00 h 30 un mardi doit compter pour mardi, pas pour lundi.
    -- Une série cassée par un fuseau horaire est une série à laquelle on ne
    -- croit plus.
    jour     date    not null,
    -- Ce qu'il a rendu ce jour-là. Sert à distinguer le passage éclair de la
    -- vraie séance de révision, dans la vue du professeur.
    rendus   integer not null default 0,
    primary key (eleve_id, jour)
);

create index if not exists jours_actifs_eleve_idx on jours_actifs (eleve_id, jour desc);

/*
 * Le classement de la classe, éteint par défaut.
 *
 * Un classement motive une partie d'une classe et démoralise l'autre — et
 * personne ne sait laquelle avant de l'avoir allumé. Ce n'est donc pas au
 * logiciel d'en décider : le responsable connaît ses élèves, il l'allume s'il
 * juge que c'est bon pour eux. Éteint, la page n'existe pas et les élèves ne
 * savent même pas qu'elle pourrait exister.
 */
alter table ecoles
    add column if not exists classement boolean not null default false;
