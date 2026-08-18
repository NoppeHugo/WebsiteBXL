-- Les commandes comptent comme un événement mesuré.
--
-- `page_events.kind` n'admettait que le vocabulaire d'un salon : « booking »
-- pour une demande de rendez-vous, et rien pour une demande de commande. Un
-- fleuriste recevait donc des commandes dont son rapport mensuel ne disait
-- rien — or ce rapport est la meilleure défense contre la résiliation, parce
-- qu'il rend visible ce que le commerçant paie. Un rapport qui annonce zéro
-- demande à quelqu'un qui en a honoré trente fait exactement l'inverse.
--
-- Type distinct plutôt que réemploi de « booking » : les deux ne se comparent
-- pas — un rendez-vous occupe un créneau, une commande ouvre une conversation
-- — et le message mensuel doit pouvoir les nommer chacun par son mot.

alter table page_events
    drop constraint if exists page_events_kind_check;

alter table page_events
    add constraint page_events_kind_check
    check (kind in ('view', 'call', 'directions', 'booking', 'contact', 'social', 'order'));
