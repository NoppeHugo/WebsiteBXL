import { sql } from "./db.ts";
import type { Ecole, Eleve, Exercice, Travail, Devoir, ChampsExercice } from "./ecole.ts";

/**
 * Les requêtes de l'espace de cours.
 *
 * ─── La règle, une seule fois ─────────────────────────────────────────────
 *
 * Toute lecture et toute écriture portent l'identifiant de l'école — celui de
 * la session, jamais celui de la page — **dans la clause `where`**, et non
 * dans une vérification faite avant. Vérifier puis écrire, ce sont deux
 * endroits où la règle peut être oubliée, et une fenêtre entre les deux. Ici,
 * une requête qui viserait l'élève d'une autre école ne renvoie simplement
 * rien.
 *
 * C'est la même discipline que l'espace commerçant (`db.ts`), pour la même
 * raison : ce qui sépare deux écoles est ce qui sépare les résultats d'un
 * enfant de la curiosité du voisin.
 */

/**
 * La date d'aujourd'hui, à Bruxelles.
 *
 * `current_date` répondrait en UTC, fuseau du serveur. Un élève qui rend un
 * exercice à 00 h 30 un mardi compterait pour lundi, et un devoir dû lundi
 * serait annoncé en retard pendant deux heures avant de l'être. Une série
 * cassée par un fuseau horaire est une série à laquelle on ne croit plus.
 */
const aujourdhui = () => sql`(now() at time zone 'Europe/Brussels')::date`;

/* -------------------------------------------------------------------------- */
/* L'école et son responsable                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Ouvre une école et le compte qui la gouverne, d'un seul tenant.
 *
 * Les deux écritures sont dans la même transaction : une école sans compte
 * serait invisible et inaccessible, un compte sans école ouvrirait une page
 * qui plante. Aucun des deux ne doit pouvoir exister seul.
 */
export async function creerEcole(
  nom: string,
  email: string,
  passwordHash: string,
): Promise<{ ok: true; ecoleId: string; adminId: string } | { ok: false; raison: string }> {
  const normalise = email.trim().toLowerCase();

  const pris = await sql<Array<{ id: string }>>`
    select id from admin_users where email = ${normalise}
  `;
  if (pris[0]) {
    return { ok: false, raison: "Cette adresse est déjà utilisée." };
  }
  // Un élève et un responsable ne peuvent pas partager une adresse : la
  // connexion ne saurait pas laquelle des deux pages ouvrir.
  const eleve = await sql<Array<{ id: string }>>`
    select id from eleves where email = ${normalise}
  `;
  if (eleve[0]) {
    return { ok: false, raison: "Cette adresse est déjà celle d'un élève." };
  }

  return sql.begin(async (tx) => {
    const [ecole] = await tx<Array<{ id: string }>>`
      insert into ecoles (nom) values (${nom}) returning id
    `;
    const [compte] = await tx<Array<{ id: string }>>`
      insert into admin_users (email, password_hash, ecole_id)
      values (${normalise}, ${passwordHash}, ${ecole!.id})
      returning id
    `;
    return { ok: true as const, ecoleId: ecole!.id, adminId: compte!.id };
  });
}

export async function ecole(id: number): Promise<Ecole | undefined> {
  const rows = await sql<Ecole[]>`
    select id, nom, classement, created_at from ecoles where id = ${id}
  `;
  return rows[0];
}

export async function renommerEcole(id: number, nom: string): Promise<void> {
  await sql`update ecoles set nom = ${nom} where id = ${id}`;
}

export interface EcoleListee {
  id: string;
  nom: string;
  email: string;
  created_at: Date;
  eleves: number;
  exercices: number;
  derniere_activite: Date | null;
}

/** Les écoles ouvertes sur la plateforme, pour la page de l'exploitant. */
export async function ecolesListees(): Promise<EcoleListee[]> {
  return sql<EcoleListee[]>`
    select c.id, c.nom, a.email, c.created_at,
           (select count(*) from eleves e where e.ecole_id = c.id)::int as eleves,
           (select count(*) from exercices x where x.ecole_id = c.id)::int as exercices,
           (select max(t.updated_at) from travaux t
              join eleves e on e.id = t.eleve_id
             where e.ecole_id = c.id) as derniere_activite
    from ecoles c
    join admin_users a on a.ecole_id = c.id
    order by c.created_at desc
  `;
}

/**
 * Ferme une école : le compte, les élèves, les exercices et les travaux.
 *
 * La cascade est déclarée dans la migration plutôt qu'écrite ici en cinq
 * suppressions : une table ajoutée plus tard serait oubliée dans la liste, et
 * il resterait les réponses d'élèves d'une école qui n'existe plus.
 */
export async function fermerEcole(id: string): Promise<void> {
  await sql`delete from ecoles where id = ${id}`;
}

/* -------------------------------------------------------------------------- */
/* Les élèves                                                                 */
/* -------------------------------------------------------------------------- */

/*
 * Les colonnes d'un élève, écrites une fois.
 *
 * Une fonction plutôt qu'une constante : un fragment de `postgres` est un
 * objet de requête, et le même objet réemployé dans quinze requêtes est un
 * partage d'état dont on n'a nul besoin ici. Fabriquer le fragment à chaque
 * appel ne coûte rien et ne surprend personne.
 */
const champsEleve = () => sql`
  id, ecole_id, email, prenom, nom, password_hash,
  invitation, invitation_fin, actif_le, last_login_at, created_at
`;

export async function eleveParEmail(email: string): Promise<Eleve | undefined> {
  const rows = await sql<Eleve[]>`
    select ${champsEleve()} from eleves where email = ${email.trim().toLowerCase()}
  `;
  return rows[0];
}

/**
 * Relu à chaque requête, comme le compte de la console : un élève retiré par
 * son professeur doit l'être tout de suite, pas à l'expiration de son cookie.
 */
export async function eleveParId(id: number): Promise<Eleve | undefined> {
  const rows = await sql<Eleve[]>`select ${champsEleve()} from eleves where id = ${id}`;
  return rows[0];
}

export async function eleveParInvitation(jeton: string): Promise<Eleve | undefined> {
  const rows = await sql<Eleve[]>`
    select ${champsEleve()} from eleves where invitation = ${jeton}
  `;
  return rows[0];
}

/** L'élève, à condition qu'il soit bien de cette école. */
export async function eleveDeLEcole(
  ecoleId: number,
  id: string,
): Promise<Eleve | undefined> {
  const rows = await sql<Eleve[]>`
    select ${champsEleve()} from eleves
    where ecole_id = ${ecoleId} and id = ${id}
  `;
  return rows[0];
}

export async function inviterEleve(
  ecoleId: number,
  eleve: { prenom: string; nom: string; email: string },
  jeton: string,
  fin: Date,
): Promise<{ ok: true; eleve: Eleve } | { ok: false; raison: string }> {
  const email = eleve.email.trim().toLowerCase();

  const ailleurs = await sql<Array<{ ecole_id: string }>>`
    select ecole_id from eleves where email = ${email}
  `;
  if (ailleurs[0]) {
    return {
      ok: false,
      raison:
        Number(ailleurs[0].ecole_id) === ecoleId
          ? "Cet élève est déjà inscrit dans votre école."
          : "Cette adresse est déjà celle d'un élève d'une autre école.",
    };
  }
  const responsable = await sql<Array<{ id: string }>>`
    select id from admin_users where email = ${email}
  `;
  if (responsable[0]) {
    return { ok: false, raison: "Cette adresse est celle d'un compte responsable." };
  }

  const rows = await sql<Eleve[]>`
    insert into eleves (ecole_id, email, prenom, nom, invitation, invitation_fin)
    values (${ecoleId}, ${email}, ${eleve.prenom}, ${eleve.nom}, ${jeton}, ${fin})
    returning ${champsEleve()}
  `;
  return { ok: true, eleve: rows[0]! };
}

/**
 * Refabrique l'invitation d'un élève qui ne s'est jamais connecté.
 *
 * Le premier lien s'est perdu — boîte pleine, adresse mal orthographiée,
 * message classé en indésirable. Sans ce bouton, la seule issue serait de
 * supprimer l'élève et de le recréer, ce qui effacerait aussi ses devoirs.
 */
export async function renouvelerInvitation(
  ecoleId: number,
  id: string,
  jeton: string,
  fin: Date,
): Promise<Eleve | undefined> {
  const rows = await sql<Eleve[]>`
    update eleves
       set invitation = ${jeton}, invitation_fin = ${fin}
     where ecole_id = ${ecoleId} and id = ${id} and actif_le is null
    returning ${champsEleve()}
  `;
  return rows[0];
}

/** L'élève choisit son mot de passe : l'invitation est consommée du même coup. */
export async function activerEleve(id: string, passwordHash: string): Promise<void> {
  await sql`
    update eleves
       set password_hash = ${passwordHash},
           invitation = null,
           invitation_fin = null,
           actif_le = now(),
           -- Il est connecté dans la foulée : sans cette ligne, son professeur
           -- lisait « jamais connecté » sur un élève qui venait d'entrer.
           last_login_at = now()
     where id = ${id}
  `;
}

export async function changerMotDePasseEleve(
  id: number,
  passwordHash: string,
): Promise<void> {
  await sql`update eleves set password_hash = ${passwordHash} where id = ${id}`;
}

export async function touchLoginEleve(id: string): Promise<void> {
  await sql`update eleves set last_login_at = now() where id = ${id}`;
}

export async function retirerEleve(ecoleId: number, id: string): Promise<boolean> {
  // Supprimé, pas désactivé : un élève qui quitte l'école ne doit plus figurer
  // dans la liste de son professeur, et ses réponses partent avec lui.
  const rows = await sql`
    delete from eleves where ecole_id = ${ecoleId} and id = ${id} returning id
  `;
  return rows.length > 0;
}

export interface EleveResume {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  actif_le: Date | null;
  last_login_at: Date | null;
  invitation: string | null;
  invitation_fin: Date | null;
  rendus: number;
  acquis: number;
  a_lheure: number;
  a_corriger: number;
  retards: number;
  derniere_activite: Date | null;
  /**
   * Les jours travaillés récemment, en AAAA-MM-JJ, pour la série.
   *
   * Bornés à six semaines : au-delà, la série est de toute façon rompue, et
   * une classe de cent élèves n'a pas à traîner deux ans d'historique à chaque
   * ouverture de page. Rendus en texte plutôt qu'en dates — le calcul de série
   * compare des jours, pas des instants.
   */
  jours: string[];
}

/**
 * La liste des élèves avec, pour chacun, ce qui se voit d'un coup d'œil.
 *
 * Les comptes sont faits par la base et non en parcourant les travaux dans le
 * programme : cent élèves et quarante exercices font quatre mille lignes, et
 * la page du responsable s'ouvre sur un téléphone, en salle de cours.
 */
export async function resumeDesEleves(ecoleId: number): Promise<EleveResume[]> {
  return sql<EleveResume[]>`
    select e.id, e.prenom, e.nom, e.email, e.actif_le, e.last_login_at,
           e.invitation, e.invitation_fin,
           (select count(*) from travaux t
              join exercices x on x.id = t.exercice_id
             where t.eleve_id = e.id and x.publie and t.statut = 'rendu')::int as rendus,
           (select count(*) from travaux t
              join exercices x on x.id = t.exercice_id
             where t.eleve_id = e.id and x.publie
               and t.statut = 'rendu' and t.appreciation = 'acquis'
               and t.corrige_le is not null)::int as acquis,
           (select count(*) from devoirs d
              join exercices x on x.id = d.exercice_id
              join travaux t on t.exercice_id = d.exercice_id and t.eleve_id = e.id
             where d.eleve_id = e.id and x.publie
               and d.du_le is not null and t.statut = 'rendu'
               and (t.rendu_le at time zone 'Europe/Brussels')::date <= d.du_le)::int
             as a_lheure,
           (select count(*) from travaux t
              join exercices x on x.id = t.exercice_id
             where t.eleve_id = e.id and x.publie
               and t.statut = 'rendu' and t.corrige_le is null)::int as a_corriger,
           (select count(*) from devoirs d
              join exercices x on x.id = d.exercice_id
             where d.eleve_id = e.id and x.publie
               and d.du_le is not null and d.du_le < ${aujourdhui()}
               and not exists (
                 select 1 from travaux t
                  where t.eleve_id = e.id and t.exercice_id = d.exercice_id
                    and t.statut = 'rendu'))::int as retards,
           (select max(t.updated_at) from travaux t where t.eleve_id = e.id)
             as derniere_activite,
           coalesce(
             (select array_agg(to_char(j.jour, 'YYYY-MM-DD'))
                from jours_actifs j
               where j.eleve_id = e.id and j.jour > ${aujourdhui()} - 42),
             '{}') as jours
      from eleves e
     where e.ecole_id = ${ecoleId}
     order by e.prenom, e.nom
  `;
}

/* -------------------------------------------------------------------------- */
/* Les exercices                                                              */
/* -------------------------------------------------------------------------- */

const champsExercice = () =>
  sql`id, titre, consigne, lien, matiere, ordre, publie, updated_at`;

/** Tout le catalogue, brouillons compris : la vue du responsable. */
export async function exercicesDeLEcole(ecoleId: number): Promise<Exercice[]> {
  return sql<Exercice[]>`
    select ${champsExercice()} from exercices
    where ecole_id = ${ecoleId}
    order by ordre, id
  `;
}

/**
 * Ce que voit l'élève : les exercices publiés, tous ouverts.
 *
 * Aucun filtre de progression, et c'est le cœur du dispositif. L'élève choisit
 * ce qu'il travaille ce soir sans avoir à terminer les précédents ; le seul
 * ordre imposé est celui des devoirs que son professeur lui a posés.
 */
export async function exercicesOuverts(ecoleId: string): Promise<Exercice[]> {
  return sql<Exercice[]>`
    select ${champsExercice()} from exercices
    where ecole_id = ${ecoleId} and publie
    order by ordre, id
  `;
}

export async function exerciceDeLEcole(
  ecoleId: number,
  id: string,
): Promise<Exercice | undefined> {
  const rows = await sql<Exercice[]>`
    select ${champsExercice()} from exercices
    where ecole_id = ${ecoleId} and id = ${id}
  `;
  return rows[0];
}

/**
 * L'exercice que l'élève a le droit d'ouvrir : le sien, et publié.
 *
 * Les deux conditions dans la même requête. Vérifier l'école ici et la
 * publication ailleurs, c'est laisser passer un brouillon à qui devine un
 * identifiant — or un brouillon contient souvent le corrigé.
 */
export async function exerciceOuvert(
  ecoleId: string,
  id: string,
): Promise<Exercice | undefined> {
  const rows = await sql<Exercice[]>`
    select ${champsExercice()} from exercices
    where ecole_id = ${ecoleId} and id = ${id} and publie
  `;
  return rows[0];
}

export async function creerExercice(
  ecoleId: number,
  champs: ChampsExercice,
): Promise<Exercice> {
  const rows = await sql<Exercice[]>`
    insert into exercices (ecole_id, titre, consigne, lien, matiere, ordre)
    values (
      ${ecoleId}, ${champs.titre}, ${champs.consigne}, ${champs.lien}, ${champs.matiere},
      -- Le nouvel exercice se range à la fin, là où on l'attend : celui qu'on
      -- vient d'écrire est le suivant du programme, pas le premier.
      (select coalesce(max(ordre), 0) + 1 from exercices where ecole_id = ${ecoleId})
    )
    returning ${champsExercice()}
  `;
  return rows[0]!;
}

export async function modifierExercice(
  ecoleId: number,
  id: string,
  champs: ChampsExercice,
  ordre: number,
): Promise<boolean> {
  const rows = await sql`
    update exercices
       set titre = ${champs.titre}, consigne = ${champs.consigne},
           lien = ${champs.lien}, matiere = ${champs.matiere},
           ordre = ${ordre}, updated_at = now()
     where ecole_id = ${ecoleId} and id = ${id}
    returning id
  `;
  return rows.length > 0;
}

export async function publierExercice(
  ecoleId: number,
  id: string,
  publie: boolean,
): Promise<boolean> {
  const rows = await sql`
    update exercices set publie = ${publie}, updated_at = now()
     where ecole_id = ${ecoleId} and id = ${id}
    returning id
  `;
  return rows.length > 0;
}

/** Rend faux si rien n'a été supprimé : l'exercice d'une autre école, ou plus rien. */
export async function supprimerExercice(ecoleId: number, id: string): Promise<boolean> {
  const rows = await sql`
    delete from exercices where ecole_id = ${ecoleId} and id = ${id} returning id
  `;
  return rows.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Les travaux                                                                */
/* -------------------------------------------------------------------------- */

const champsTravail = () => sql`
  exercice_id, reponse, statut, rendu_le, correction, appreciation, corrige_le
`;

export async function travauxDeLEleve(eleveId: string): Promise<Travail[]> {
  return sql<Travail[]>`
    select ${champsTravail()} from travaux where eleve_id = ${eleveId}
  `;
}

export async function travailDeLEleve(
  eleveId: number,
  exerciceId: string,
): Promise<Travail | undefined> {
  const rows = await sql<Travail[]>`
    select ${champsTravail()} from travaux
    where eleve_id = ${eleveId} and exercice_id = ${exerciceId}
  `;
  return rows[0];
}

/**
 * Enregistre ce qu'a écrit l'élève, en brouillon ou rendu.
 *
 * L'écriture ne passe que si l'exercice appartient à l'école de l'élève et
 * qu'il est publié : c'est la sous-requête qui le dit, dans la même
 * instruction. Un identifiant d'exercice fabriqué à la main ne crée donc rien.
 *
 * Rendre une seconde version efface la correction précédente : elle portait
 * sur un texte qui n'existe plus, et la laisser afficherait au professeur un
 * « acquis » qu'il n'a pas donné à cette copie-là.
 */
export async function enregistrerTravail(
  eleve: { id: number; ecole_id: string },
  exerciceId: string,
  reponse: string,
  rendre: boolean,
): Promise<boolean> {
  const rows = await sql`
    insert into travaux (eleve_id, exercice_id, reponse, statut, rendu_le)
    select ${eleve.id}, x.id, ${reponse},
           ${rendre ? "rendu" : "commence"}, ${rendre ? sql`now()` : sql`null`}
      from exercices x
     where x.id = ${exerciceId} and x.ecole_id = ${eleve.ecole_id} and x.publie
    on conflict (eleve_id, exercice_id) do update set
      reponse      = excluded.reponse,
      statut       = excluded.statut,
      rendu_le     = coalesce(excluded.rendu_le, travaux.rendu_le),
      correction   = case when ${rendre} then null else travaux.correction end,
      appreciation = case when ${rendre} then null else travaux.appreciation end,
      corrige_le   = case when ${rendre} then null else travaux.corrige_le end,
      updated_at   = now()
    returning id
  `;
  if (rows.length === 0) return false;

  /*
   * Le jour n'est marqué que sur une **remise**, jamais sur un brouillon.
   *
   * Une série qui s'entretiendrait en enregistrant un champ vide ne mesurerait
   * plus rien, et l'élève le sait avant nous : ce serait la première chose
   * qu'il trouverait. Rendre quelque chose reste le seul geste qui compte.
   */
  if (rendre) await marquerJourTravaille(eleve.id);
  return true;
}

/**
 * Retient qu'un élève a travaillé aujourd'hui.
 *
 * Écrit une fois par jour et par élève, jamais réécrit : c'est cette mémoire
 * qui permet à une série de survivre à un vieil exercice repris, alors que
 * `travaux.rendu_le` ne garde que la dernière remise (voir la migration 012).
 */
export async function marquerJourTravaille(eleveId: number): Promise<void> {
  await sql`
    insert into jours_actifs (eleve_id, jour, rendus)
    values (${eleveId}, ${aujourdhui()}, 1)
    on conflict (eleve_id, jour) do update set rendus = jours_actifs.rendus + 1
  `;
}

/**
 * La correction du responsable.
 *
 * La jointure sur l'élève **et** sur l'exercice fait la vérification : les deux
 * doivent appartenir à son école. Corriger le travail d'un élève d'ailleurs ne
 * renvoie rien plutôt que d'écrire au mauvais endroit.
 */
export async function corrigerTravail(
  ecoleId: number,
  eleveId: string,
  exerciceId: string,
  correction: string,
  appreciation: "acquis" | "a_revoir",
): Promise<boolean> {
  const rows = await sql`
    update travaux t
       set correction = ${correction}, appreciation = ${appreciation},
           corrige_le = now(), updated_at = now()
      from eleves e, exercices x
     where e.id = t.eleve_id and x.id = t.exercice_id
       and e.ecole_id = ${ecoleId} and x.ecole_id = ${ecoleId}
       and t.eleve_id = ${eleveId} and t.exercice_id = ${exerciceId}
       and t.statut = 'rendu'
    returning t.id
  `;
  return rows.length > 0;
}

/** Ce qui attend le responsable : rendu, pas encore corrigé. */
export async function travauxACorriger(ecoleId: number): Promise<number> {
  const rows = await sql<Array<{ n: number }>>`
    select count(*)::int as n
      from travaux t
      join eleves e on e.id = t.eleve_id
      join exercices x on x.id = t.exercice_id
     where e.ecole_id = ${ecoleId} and x.ecole_id = ${ecoleId}
       and t.statut = 'rendu' and t.corrige_le is null
  `;
  return rows[0]?.n ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Ce que l'élève a gagné                                                     */
/* -------------------------------------------------------------------------- */

export interface StatsBrutes {
  rendus: number;
  acquis: number;
  aLHeure: number;
  total: number;
  jours: string[];
}

/**
 * Les quatre comptes et la liste des jours, en une requête.
 *
 * Comptés par la base plutôt qu'en parcourant les travaux : la page d'accueil
 * de l'élève les affiche à chaque ouverture, et quarante exercices ramenés
 * pour en compter trois seraient quarante de trop. Les points, le niveau et
 * les hauts faits s'en déduisent dans `jeu.ts` — la base compte, elle ne juge
 * pas.
 */
export async function statsDeLEleve(
  eleveId: number,
  ecoleId: string,
): Promise<StatsBrutes> {
  const rows = await sql<
    Array<{ rendus: number; acquis: number; a_lheure: number; total: number; jours: string[] }>
  >`
    select
      (select count(*) from travaux t
         join exercices x on x.id = t.exercice_id
        where t.eleve_id = ${eleveId} and x.publie and t.statut = 'rendu')::int as rendus,
      (select count(*) from travaux t
         join exercices x on x.id = t.exercice_id
        where t.eleve_id = ${eleveId} and x.publie and t.statut = 'rendu'
          and t.appreciation = 'acquis' and t.corrige_le is not null)::int as acquis,
      (select count(*) from devoirs d
         join exercices x on x.id = d.exercice_id
         join travaux t on t.exercice_id = d.exercice_id and t.eleve_id = d.eleve_id
        where d.eleve_id = ${eleveId} and x.publie
          and d.du_le is not null and t.statut = 'rendu'
          and (t.rendu_le at time zone 'Europe/Brussels')::date <= d.du_le)::int as a_lheure,
      (select count(*) from exercices x
        where x.ecole_id = ${ecoleId} and x.publie)::int as total,
      coalesce(
        (select array_agg(to_char(j.jour, 'YYYY-MM-DD'))
           from jours_actifs j
          where j.eleve_id = ${eleveId} and j.jour > ${aujourdhui()} - 42),
        '{}') as jours
  `;
  const r = rows[0];
  return {
    rendus: r?.rendus ?? 0,
    acquis: r?.acquis ?? 0,
    aLHeure: r?.a_lheure ?? 0,
    total: r?.total ?? 0,
    jours: r?.jours ?? [],
  };
}

/** La date du jour telle que la base la voit, pour que les deux s'accordent. */
export async function jourCourant(): Promise<string> {
  const rows = await sql<Array<{ jour: string }>>`
    select to_char(${aujourdhui()}, 'YYYY-MM-DD') as jour
  `;
  return rows[0]!.jour;
}

/** Le classement est-il allumé dans cette école ? */
export async function basculerClassement(
  ecoleId: number,
  actif: boolean,
): Promise<void> {
  await sql`update ecoles set classement = ${actif} where id = ${ecoleId}`;
}

/* -------------------------------------------------------------------------- */
/* Les devoirs                                                                */
/* -------------------------------------------------------------------------- */

export async function devoirsDeLEleve(eleveId: string): Promise<Devoir[]> {
  return sql<Devoir[]>`
    select exercice_id, du_le from devoirs where eleve_id = ${eleveId}
  `;
}

/**
 * Pose un devoir, ou change sa date s'il était déjà posé.
 *
 * L'élève et l'exercice sont contrôlés par la même instruction : deux
 * sous-requêtes qui exigent la même école. Le devoir n'est créé que si les deux
 * répondent — un exercice en brouillon compris, car un responsable prépare
 * parfois le devoir avant de publier l'énoncé.
 */
export async function poserDevoir(
  ecoleId: number,
  eleveId: string,
  exerciceId: string,
  du_le: Date | null,
): Promise<boolean> {
  const rows = await sql`
    insert into devoirs (eleve_id, exercice_id, du_le)
    select e.id, x.id, ${du_le}
      from eleves e, exercices x
     where e.id = ${eleveId} and e.ecole_id = ${ecoleId}
       and x.id = ${exerciceId} and x.ecole_id = ${ecoleId}
    on conflict (eleve_id, exercice_id) do update set du_le = excluded.du_le
    returning id
  `;
  return rows.length > 0;
}

export async function retirerDevoir(
  ecoleId: number,
  eleveId: string,
  exerciceId: string,
): Promise<boolean> {
  const rows = await sql`
    delete from devoirs d
     using eleves e
     where e.id = d.eleve_id and e.ecole_id = ${ecoleId}
       and d.eleve_id = ${eleveId} and d.exercice_id = ${exerciceId}
    returning d.id
  `;
  return rows.length > 0;
}
