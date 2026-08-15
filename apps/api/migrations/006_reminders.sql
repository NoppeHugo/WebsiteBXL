-- Annulation en ligne et rappel de rendez-vous.
--
-- Les absences sont le coût invisible d'un agenda en ligne : un créneau perdu
-- n'est pas revendable. Deux mesures, dans cet ordre d'efficacité : permettre
-- d'annuler en un clic — un créneau libéré est un créneau récupérable — et
-- rappeler la veille.

alter table appointments
    -- Jeton d'annulation, envoyé dans le courriel de confirmation. Il vaut
    -- authentification : le connaître prouve qu'on a reçu ce courriel.
    add column if not exists cancel_token uuid not null default gen_random_uuid(),
    add column if not exists reminder_sent_at timestamptz;

create unique index if not exists appointments_cancel_token_idx
    on appointments (cancel_token);
