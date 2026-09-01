import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { adresseDuPortail } from "../config.ts";
import { hashPassword, verifyPassword } from "../auth.ts";
import { findAdminById, changerMotDePasse } from "../db.ts";
import { utilisateur, ecoleDuResponsable } from "../acces.ts";
import { sendMail } from "../mail.ts";
import {
  ecole as lireEcole,
  renommerEcole,
  resumeDesEleves,
  eleveDeLEcole,
  inviterEleve,
  renouvelerInvitation,
  retirerEleve,
  exercicesDeLEcole,
  exerciceDeLEcole,
  creerExercice,
  modifierExercice,
  publierExercice,
  supprimerExercice,
  travauxDeLEleve,
  travauxACorriger,
  corrigerTravail,
  devoirsDeLEleve,
  poserDevoir,
  retirerDevoir,
  jourCourant,
  basculerClassement,
} from "../db-ecole.ts";
import {
  avancement,
  dateDeRemise,
  emailValide,
  enRetard,
  etatDuTravail,
  nomComplet,
  validerExercice,
  type Exercice,
} from "../ecole.ts";
import { escape } from "../views.ts";
import { niveauDe, points, semaine, serie } from "../jeu.ts";
import {
  layoutEcole,
  message,
  carte,
  copie,
  depuisLisible,
  puce,
  puceEcheance,
  puceEtat,
  anneau,
  friseSerie,
  tuile,
} from "../views-ecole.ts";

/**
 * L'espace du responsable d'école.
 *
 * Trois choses, et rien d'autre : ses exercices, ses élèves, et ce que chacun
 * a fait. Toutes les routes commencent par `/cours` et tirent l'école de la
 * **session**, jamais de l'URL — même discipline que l'espace commerçant, pour
 * la même raison : il n'y a aucun paramètre à falsifier, parce qu'il n'y en a
 * pas.
 *
 * Les identifiants d'élève et d'exercice, eux, viennent bien de l'adresse —
 * mais chaque requête les recoupe avec l'école de la session (`db-ecole.ts`),
 * dans la même instruction SQL. Un identifiant emprunté à une autre école ne
 * renvoie rien.
 */

type Flash = { ton: "ok" | "ko"; texte: string };

/** Quatorze jours : le temps qu'un élève relève sa boîte et pas beaucoup plus. */
const INVITATION_JOURS = 14;

function jetonInvitation(): string {
  return randomBytes(24).toString("base64url");
}

function finInvitation(): Date {
  return new Date(Date.now() + INVITATION_JOURS * 86_400_000);
}

/**
 * L'adresse complète de l'invitation.
 *
 * Complète, et non relative : elle part dans un courriel, et « /invitation/… »
 * n'y mène nulle part. `adresseDuPortail()` répond en production ; en
 * développement, où ni le portail ni l'adresse publique ne sont renseignés, on
 * se rabat sur l'hôte par lequel la requête est arrivée — c'est-à-dire celui
 * que le professeur a sous les yeux.
 */
function lienInvitation(request: FastifyRequest, jeton: string): string {
  const base =
    adresseDuPortail() || `${request.protocol}://${request.headers.host ?? request.hostname}`;
  return `${base}/invitation/${jeton}`;
}

/* -------------------------------------------------------------------------- */
/* Accueil                                                                    */
/* -------------------------------------------------------------------------- */

async function pageAccueil(ecoleId: number, flash?: Flash): Promise<string> {
  const [ecole, eleves, exercices, aCorriger] = await Promise.all([
    lireEcole(ecoleId),
    resumeDesEleves(ecoleId),
    exercicesDeLEcole(ecoleId),
    travauxACorriger(ecoleId),
  ]);

  const nom = ecole?.nom ?? "Mon école";
  const publies = exercices.filter((x) => x.publie).length;
  const retards = eleves.reduce((total, e) => total + e.retards, 0);
  const jamaisVenus = eleves.filter((e) => !e.actif_le).length;

  /*
   * Le bandeau répond à la seule question qui se pose en ouvrant la page :
   * « qu'est-ce qui m'attend ? ». Dans l'ordre où cela presse — corriger ce qui
   * est rendu passe avant relancer un retard, qui passe avant tout le reste.
   */
  const bandeau =
    aCorriger > 0
      ? `<div class="etat" data-ton="alerte">
    <b>${aCorriger} travail${aCorriger > 1 ? "x" : ""} à corriger</b>
    <span>Vos élèves attendent votre retour.</span>
    <a class="etat__lien" href="/cours/eleves">Voir qui a rendu →</a>
  </div>`
      : retards > 0
        ? `<div class="etat" data-ton="alerte">
    <b>${retards} devoir${retards > 1 ? "s" : ""} en retard</b>
    <span>La date est passée et l'exercice n'a pas été rendu.</span>
    <a class="etat__lien" href="/cours/eleves">Voir lesquels →</a>
  </div>`
        : exercices.length === 0
          ? `<div class="etat">
    <b>Commencez par un exercice</b>
    <span>Écrivez-en un, publiez-le, puis invitez vos élèves : ils le verront
      apparaître dans leur liste.</span>
    <a class="etat__lien" href="/cours/exercices">Écrire mon premier exercice →</a>
  </div>`
          : eleves.length === 0
            ? `<div class="etat">
    <b>Invitez vos élèves</b>
    <span>Vous avez ${publies} exercice${publies > 1 ? "s" : ""} publié${
      publies > 1 ? "s" : ""
    }. Il ne manque que ceux qui vont les faire.</span>
    <a class="etat__lien" href="/cours/eleves">Inviter un élève →</a>
  </div>`
            : `<div class="etat">
    <b>Rien ne vous attend</b>
    <span>Tout ce qui a été rendu est corrigé, et aucun devoir n'est en retard.</span>
  </div>`;

  return layoutEcole(
    nom,
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Bonjour</h1>
<p class="chapeau">Votre classe en un coup d'œil.</p>

<div class="tuiles">
  ${tuile({ valeur: eleves.length, libelle: eleves.length > 1 ? "élèves" : "élève", href: "/cours/eleves" })}
  ${tuile({ valeur: publies, libelle: "exercices publiés", href: "/cours/exercices" })}
  ${tuile({
    valeur: aCorriger,
    libelle: "à corriger",
    href: "/cours/eleves",
    ton: aCorriger > 0 ? "alerte" : undefined,
  })}
  ${tuile({
    valeur: retards,
    libelle: "devoirs en retard",
    href: "/cours/eleves",
    ton: retards > 0 ? "alerte" : undefined,
  })}
</div>

${bandeau}

<div class="menu">
  ${carte({
    href: "/cours/eleves",
    icone: "🎓",
    titre: "Mes élèves",
    sous: "Qui a fait quoi, et à qui donner du travail",
    compte: aCorriger || undefined,
  })}
  ${carte({
    href: "/cours/exercices",
    icone: "📝",
    titre: "Mes exercices",
    sous: "Écrire, publier, réorganiser",
  })}
  ${carte({
    href: "/cours/mot-de-passe",
    icone: "🔑",
    titre: "Mon compte",
    sous: "Le nom de l'école et mon mot de passe",
  })}
</div>

${
  jamaisVenus > 0
    ? `<p class="aide">${jamaisVenus} élève${jamaisVenus > 1 ? "s" : ""} n'${
        jamaisVenus > 1 ? "ont" : "a"
      } jamais ouvert son espace. Une invitation se renvoie depuis sa fiche.</p>`
    : ""
}
<p class="aide">
  Vos élèves ouvrent les exercices dans l'ordre qu'ils veulent. Pour en imposer
  un, posez-leur un devoir : il apparaîtra en tête de leur liste.
</p>`,
    { nom },
  );
}

/* -------------------------------------------------------------------------- */
/* Exercices                                                                  */
/* -------------------------------------------------------------------------- */

function ficheExercice(x: Exercice): string {
  return `<div class="fiche">
  <div class="fiche__titre">
    <a href="/cours/exercices/${escape(x.id)}">${escape(x.titre)}</a>
  </div>
  ${x.matiere ? `<div class="fiche__detail">${escape(x.matiere)}</div>` : ""}
  <div style="margin-top:0.5rem">
    <span class="puce"${x.publie ? "" : ' data-ton="brouillon"'}>${
      x.publie ? "Publié" : "Brouillon"
    }</span>
  </div>
  <form method="post" action="/cours/exercices/${escape(x.id)}/publier">
    <input type="hidden" name="publie" value="${x.publie ? "non" : "oui"}">
    <button type="submit" class="second">${
      x.publie ? "Retirer de la liste des élèves" : "Publier pour mes élèves"
    }</button>
  </form>
</div>`;
}

async function pageExercices(ecoleId: number, flash?: Flash): Promise<string> {
  const ecole = await lireEcole(ecoleId);
  const exercices = await exercicesDeLEcole(ecoleId);

  return layoutEcole(
    "Mes exercices",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mes exercices</h1>
<p class="chapeau">
  Un exercice publié est visible par tous vos élèves, tout de suite, dans
  l'ordre que vous fixez ici. Chacun ouvre celui qu'il veut : rien ne l'oblige à
  terminer les précédents.
</p>

${
  exercices.length === 0
    ? `<p class="vide">Aucun exercice pour l'instant.</p>`
    : exercices.map(ficheExercice).join("")
}

<h2>Écrire un exercice</h2>
<form method="post" action="/cours/exercices">
  <label>Titre
    <input type="text" name="titre" required maxlength="160"
           placeholder="Les panneaux de priorité">
  </label>
  <label>Matière <span class="fiche__detail">(facultatif)</span>
    <input type="text" name="matiere" maxlength="60" placeholder="Code de la route">
  </label>
  <label>Consigne
    <textarea name="consigne" placeholder="Ce que l'élève doit faire, et comment vous voulez sa réponse."></textarea>
  </label>
  <label>Lien vers une ressource <span class="fiche__detail">(facultatif)</span>
    <input type="text" name="lien" inputmode="url" placeholder="https://…">
  </label>
  <div class="actions"><button type="submit">Ajouter l'exercice</button></div>
</form>

<p class="aide">
  Un exercice ajouté est un brouillon : vos élèves ne le voient qu'une fois
  publié.
</p>`,
    { nom: ecole?.nom, retour: "/cours" },
  );
}

async function pageExercice(
  ecoleId: number,
  id: string,
  flash?: Flash,
): Promise<string | undefined> {
  const [ecole, x] = await Promise.all([lireEcole(ecoleId), exerciceDeLEcole(ecoleId, id)]);
  if (!x) return undefined;

  return layoutEcole(
    x.titre,
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>${escape(x.titre)}</h1>
<p class="chapeau">
  ${x.publie ? "Publié : vos élèves le voient." : "Brouillon : vos élèves ne le voient pas encore."}
</p>

<form method="post" action="/cours/exercices/${escape(x.id)}">
  <label>Titre
    <input type="text" name="titre" required maxlength="160" value="${escape(x.titre)}">
  </label>
  <label>Matière
    <input type="text" name="matiere" maxlength="60" value="${escape(x.matiere ?? "")}">
  </label>
  <label>Consigne
    <textarea name="consigne">${escape(x.consigne)}</textarea>
  </label>
  <label>Lien vers une ressource
    <input type="text" name="lien" inputmode="url" value="${escape(x.lien ?? "")}">
  </label>
  <label>Rang dans la liste
    <input type="number" name="ordre" min="0" max="9999" value="${x.ordre}">
  </label>
  <div class="actions"><button type="submit">Enregistrer</button></div>
</form>

<form method="post" action="/cours/exercices/${escape(x.id)}/publier">
  <input type="hidden" name="publie" value="${x.publie ? "non" : "oui"}">
  <div class="actions">
    <button type="submit" class="second">${
      x.publie ? "Retirer de la liste des élèves" : "Publier pour mes élèves"
    }</button>
  </div>
</form>

<form method="post" action="/cours/exercices/${escape(x.id)}/supprimer">
  <div class="actions">
    <button type="submit" class="danger">Supprimer cet exercice</button>
  </div>
</form>
<p class="aide">
  Supprimer un exercice efface aussi les réponses que vos élèves y avaient
  écrites, et les devoirs qui le désignaient. Pour le mettre simplement de
  côté, retirez-le de la liste : tout est conservé.
</p>`,
    { nom: ecole?.nom, retour: "/cours/exercices" },
  );
}

/* -------------------------------------------------------------------------- */
/* Élèves                                                                     */
/* -------------------------------------------------------------------------- */

async function pageEleves(
  ecoleId: number,
  flash?: Flash,
  invitation?: { nom: string; lien: string },
): Promise<string> {
  const [ecole, eleves, exercices, jour] = await Promise.all([
    lireEcole(ecoleId),
    resumeDesEleves(ecoleId),
    exercicesDeLEcole(ecoleId),
    jourCourant(),
  ]);
  const total = exercices.filter((x) => x.publie).length;

  /*
   * Une fiche par élève, l'anneau à gauche.
   *
   * Ce que le professeur cherche en ouvrant cette page n'est pas la moyenne de
   * la classe : c'est **qui décroche**. D'où trois choses côte à côte —
   * l'avancement, le niveau, et la série, qui est le seul indicateur qui
   * bouge avant que le retard n'apparaisse. Un élève qui passait tous les
   * soirs et n'est pas venu depuis dix jours se voit ici avant de se voir
   * dans les devoirs en retard.
   */
  const lignes = eleves
    .map((e) => {
      const pts = points({ rendus: e.rendus, acquis: e.acquis, aLHeure: e.a_lheure });
      const niveau = niveauDe(pts);
      const enCours = serie(e.jours ?? [], jour);
      const pourcentage = total === 0 ? 0 : Math.round((e.rendus / total) * 100);

      return `<div class="fiche">
  <div style="display:flex;align-items:center;gap:0.9rem">
    ${anneau(
      pourcentage,
      `${e.rendus}/${total}`,
      "rendus",
      `${e.rendus} exercice(s) rendu(s) sur ${total}`,
    )}
    <div style="min-width:0;flex:1">
      <div class="fiche__titre">
        <a href="/cours/eleves/${escape(e.id)}">${escape(nomComplet(e))}</a>
      </div>
      <div class="fiche__detail">${escape(
        `${niveau.nom} · ${pts} point${pts > 1 ? "s" : ""} · ${
          e.actif_le && e.last_login_at
            ? `vu ${depuisLisible(e.last_login_at)}`
            : "jamais connecté"
        }`,
      )}</div>
      <div class="fiche__puces">
        ${enCours > 0 ? puce(`🔥 ${enCours} jour${enCours > 1 ? "s" : ""}`) : ""}
        ${e.a_corriger > 0 ? puce(`${e.a_corriger} à corriger`, "retard") : ""}
        ${e.retards > 0 ? puce(`${e.retards} en retard`, "retard") : ""}
      </div>
    </div>
  </div>
</div>`;
    })
    .join("");

  return layoutEcole(
    "Mes élèves",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mes élèves</h1>

${
  invitation
    ? `<div class="etat" data-ton="alerte">
  <b>Invitation envoyée à ${escape(invitation.nom)}</b>
  <span>Le courriel part tout de suite. S'il n'arrive pas — boîte pleine,
    message classé en indésirable — transmettez-lui ce lien vous-même. Il vaut
    ${INVITATION_JOURS} jours et ne sert qu'une fois.</span>
  <code class="copiable">${escape(invitation.lien)}</code>
</div>`
    : ""
}

${eleves.length === 0 ? `<p class="vide">Aucun élève pour l'instant.</p>` : lignes}

<h2>Inviter un élève</h2>
<form method="post" action="/cours/eleves">
  <label>Prénom
    <input type="text" name="prenom" required maxlength="80">
  </label>
  <label>Nom <span class="fiche__detail">(facultatif)</span>
    <input type="text" name="nom" maxlength="80">
  </label>
  <label>Adresse e-mail
    <input type="email" name="email" required>
  </label>
  <div class="actions"><button type="submit">Envoyer l'invitation</button></div>
</form>
<p class="aide">
  Il reçoit un lien, choisit son mot de passe, et voit aussitôt vos
  ${total} exercice${total > 1 ? "s" : ""} publié${total > 1 ? "s" : ""}.
</p>`,
    { nom: ecole?.nom, retour: "/cours" },
  );
}

async function pageEleve(
  ecoleId: number,
  id: string,
  flash?: Flash,
  invitation?: string,
): Promise<string | undefined> {
  const [ecole, eleve, exercices] = await Promise.all([
    lireEcole(ecoleId),
    eleveDeLEcole(ecoleId, id),
    exercicesDeLEcole(ecoleId),
  ]);
  if (!eleve) return undefined;

  const [travaux, devoirs, resumes, jour] = await Promise.all([
    travauxDeLEleve(eleve.id),
    devoirsDeLEleve(eleve.id),
    resumeDesEleves(ecoleId),
    jourCourant(),
  ]);

  /*
   * Les comptes du jeu viennent du même relevé que la liste des élèves, et non
   * d'un second calcul fait ici : deux calculs finiraient par afficher deux
   * niveaux différents pour le même élève sur deux pages voisines, et c'est le
   * professeur qui recevrait la question.
   */
  const resume = resumes.find((r) => String(r.id) === String(eleve.id));
  const pts = points({
    rendus: resume?.rendus ?? 0,
    acquis: resume?.acquis ?? 0,
    aLHeure: resume?.a_lheure ?? 0,
  });
  const niveau = niveauDe(pts);
  const jours = resume?.jours ?? [];
  const enCours = serie(jours, jour);

  const parExercice = new Map(travaux.map((t) => [String(t.exercice_id), t]));
  const devoirDe = new Map(devoirs.map((d) => [String(d.exercice_id), d]));
  const publies = exercices.filter((x) => x.publie);
  const av = avancement(publies.map((x) => etatDuTravail(parExercice.get(String(x.id)))));

  const fiche = (x: Exercice) => {
    const travail = parExercice.get(String(x.id));
    const etat = etatDuTravail(travail);
    const devoir = devoirDe.get(String(x.id));

    return `<div class="fiche">
  <div class="fiche__titre">${escape(x.titre)}${
    x.publie ? "" : ` ${puce("Brouillon", "brouillon")}`
  }</div>
  <div style="margin:0.4rem 0 0.2rem">
    ${puceEtat(etat)}
    ${devoir ? puceEcheance(devoir.du_le, enRetard(devoir.du_le, etat)) : ""}
  </div>
  ${
    travail && travail.reponse.trim() !== ""
      ? `${copie(travail.reponse)}
         <div class="fiche__detail" style="margin-top:0.4rem">Rendu ${escape(
           depuisLisible(travail.rendu_le),
         )}</div>`
      : `<div class="fiche__detail">Aucune réponse écrite pour l'instant.</div>`
  }
  ${
    travail?.correction
      ? `${copie(travail.correction, "professeur")}`
      : ""
  }
  ${
    travail?.statut === "rendu"
      ? `<form method="post" action="/cours/eleves/${escape(eleve.id)}/travaux/${escape(
          x.id,
        )}/corriger">
    <label>${travail.corrige_le ? "Reprendre la correction" : "Corriger"}
      <textarea name="correction" placeholder="Ce que vous lui dites.">${escape(
        travail.correction ?? "",
      )}</textarea>
    </label>
    <div class="ligne__cases">
      <label class="case">
        <input type="radio" name="appreciation" value="acquis"
               ${travail.appreciation === "acquis" ? "checked" : ""} required>
        Acquis
      </label>
      <label class="case">
        <input type="radio" name="appreciation" value="a_revoir"
               ${travail.appreciation === "a_revoir" ? "checked" : ""}>
        À revoir
      </label>
    </div>
    <button type="submit" class="second">Enregistrer la correction</button>
  </form>`
      : ""
  }
  ${
    devoir
      ? `<form method="post" action="/cours/eleves/${escape(eleve.id)}/devoirs/${escape(
          x.id,
        )}/retirer">
    <button type="submit" class="second">Retirer de ses devoirs</button>
  </form>`
      : ""
  }
</div>`;
  };

  const aFaire = exercices.filter((x) => devoirDe.has(String(x.id)));
  const reste = exercices.filter((x) => !devoirDe.has(String(x.id)));

  return layoutEcole(
    nomComplet(eleve),
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>${escape(nomComplet(eleve))}</h1>
<p class="chapeau">${escape(eleve.email)}</p>

<section class="tableau">
  <div class="tableau__haut">
    ${anneau(av.pourcentage, `${av.rendus}/${av.total}`, "rendus", `${av.rendus} sur ${av.total}`)}
    <div class="tableau__texte">
      <div class="tableau__niveau">${escape(niveau.nom)}<span class="tableau__rang">Niveau ${
        niveau.rang
      }</span></div>
      <div class="tableau__points">${pts} point${pts > 1 ? "s" : ""} · ${
        eleve.actif_le && eleve.last_login_at
          ? `vu ${escape(depuisLisible(eleve.last_login_at))}`
          : "n'a jamais ouvert son espace"
      }</div>
    </div>
  </div>
  ${friseSerie(semaine(jours, jour), enCours)}
</section>

${
  invitation
    ? `<div class="etat" data-ton="alerte">
  <b>Nouvelle invitation</b>
  <span>Elle vaut ${INVITATION_JOURS} jours. Transmettez-la si le courriel
    n'arrive pas.</span>
  <code class="copiable">${escape(invitation)}</code>
</div>`
    : ""
}

<h2>Ses devoirs</h2>
${
  aFaire.length === 0
    ? `<p class="vide">Aucun devoir. Il travaille ce qu'il veut, quand il veut.</p>`
    : aFaire.map(fiche).join("")
}

<h2>Donner un devoir</h2>
${
  exercices.length === 0
    ? `<p class="aide">Écrivez d'abord un exercice.</p>`
    : `<form method="post" action="/cours/eleves/${escape(eleve.id)}/devoirs">
  <label>L'exercice
    <select name="exercice" required>
      ${exercices
        .map(
          (x) =>
            `<option value="${escape(x.id)}">${escape(x.titre)}${
              x.publie ? "" : " (brouillon)"
            }</option>`,
        )
        .join("")}
    </select>
  </label>
  <label>Pour quelle date <span class="fiche__detail">(facultatif)</span>
    <input type="date" name="du_le">
  </label>
  <div class="actions"><button type="submit">Le mettre dans sa liste</button></div>
</form>`
}

<h2>Tout le reste</h2>
${
  reste.length === 0
    ? `<p class="vide">Tous vos exercices lui sont déjà donnés en devoir.</p>`
    : reste.map(fiche).join("")
}

<h2>Son accès</h2>
${
  eleve.actif_le
    ? `<p class="aide">Il a choisi son mot de passe. S'il l'a perdu, retirez-le
       et invitez-le à nouveau — ses réponses seraient effacées, prévenez-le.</p>`
    : `<form method="post" action="/cours/eleves/${escape(eleve.id)}/inviter">
  <div class="actions">
    <button type="submit" class="second">Renvoyer l'invitation</button>
  </div>
</form>`
}
<form method="post" action="/cours/eleves/${escape(eleve.id)}/retirer">
  <div class="actions">
    <button type="submit" class="danger">Retirer cet élève</button>
  </div>
</form>
<p class="aide">
  Le retirer supprime son compte et tout ce qu'il a écrit. Il perd l'accès à sa
  page dès sa page suivante.
</p>`,
    { nom: ecole?.nom, retour: "/cours/eleves" },
  );
}

/* -------------------------------------------------------------------------- */
/* Compte du responsable                                                      */
/* -------------------------------------------------------------------------- */

async function pageCompte(ecoleId: number, flash?: Flash): Promise<string> {
  const ecole = await lireEcole(ecoleId);
  return layoutEcole(
    "Mon compte",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mon compte</h1>

<h2>Le nom de l'école</h2>
<p class="chapeau">C'est ce que vos élèves voient en haut de leur page.</p>
<form method="post" action="/cours/nom">
  <label>Nom
    <input type="text" name="nom" required maxlength="120" value="${escape(ecole?.nom ?? "")}">
  </label>
  <div class="actions"><button type="submit">Enregistrer</button></div>
</form>

<h2>Le classement de la classe</h2>
<p class="chapeau">
  Un classement motive une partie d'une classe et démoralise l'autre, et
  personne ne sait laquelle avant de l'avoir allumé. Vous connaissez vos
  élèves : à vous de décider. Éteint, vos élèves ne savent pas qu'il existe.
</p>
<form method="post" action="/cours/classement">
  <input type="hidden" name="actif" value="${ecole?.classement ? "non" : "oui"}">
  <div class="fiche">
    <div class="fiche__titre">${
      ecole?.classement ? "Visible par vos élèves" : "Éteint"
    }</div>
    <div class="fiche__detail">
      ${
        ecole?.classement
          ? "Chacun voit les prénoms de la classe, leur niveau et leurs points."
          : "Chaque élève ne voit que sa propre progression."
      }
    </div>
    <button type="submit" class="second">${
      ecole?.classement ? "Éteindre le classement" : "Allumer le classement"
    }</button>
  </div>
</form>

<h2>Mon mot de passe</h2>
<form method="post" action="/cours/mot-de-passe">
  <label>Mot de passe actuel
    <input type="password" name="actuel" required autocomplete="current-password">
  </label>
  <label>Nouveau mot de passe
    <input type="password" name="nouveau" required minlength="12" autocomplete="new-password">
  </label>
  <label>Le même, pour être sûr
    <input type="password" name="confirmation" required minlength="12" autocomplete="new-password">
  </label>
  <div class="actions"><button type="submit">Changer mon mot de passe</button></div>
</form>`,
    { nom: ecole?.nom, retour: "/cours" },
  );
}

/* -------------------------------------------------------------------------- */

export function coursRoutes(app: FastifyInstance): void {
  const ecoleDe = (request: FastifyRequest) =>
    ecoleDuResponsable(utilisateur(request));

  app.get("/cours", async (request, reply) =>
    reply.type("text/html").send(await pageAccueil(ecoleDe(request))),
  );

  /* --- Exercices --------------------------------------------------------- */

  app.get("/cours/exercices", async (request, reply) =>
    reply.type("text/html").send(await pageExercices(ecoleDe(request))),
  );

  app.post<{ Body: Record<string, string> }>(
    "/cours/exercices",
    async (request, reply) => {
      const ecoleId = ecoleDe(request);
      const valide = validerExercice(request.body ?? {});
      if (!valide.ok) {
        return reply
          .code(400)
          .type("text/html")
          .send(await pageExercices(ecoleId, { ton: "ko", texte: valide.raison }));
      }

      const x = await creerExercice(ecoleId, valide.valeur);
      return reply.type("text/html").send(
        await pageExercices(ecoleId, {
          ton: "ok",
          texte: `« ${x.titre} » ajouté, en brouillon.`,
        }),
      );
    },
  );

  app.get<{ Params: { id: string } }>(
    "/cours/exercices/:id",
    async (request, reply) => {
      const page = await pageExercice(ecoleDe(request), request.params.id);
      if (!page) return reply.code(404).type("text/html").send(await introuvable(request));
      return reply.type("text/html").send(page);
    },
  );

  app.post<{ Params: { id: string }; Body: Record<string, string> }>(
    "/cours/exercices/:id",
    async (request, reply) => {
      const ecoleId = ecoleDe(request);
      const { id } = request.params;
      const valide = validerExercice(request.body ?? {});
      if (!valide.ok) {
        const page = await pageExercice(ecoleId, id, { ton: "ko", texte: valide.raison });
        return reply.code(400).type("text/html").send(page ?? (await introuvable(request)));
      }

      const ordre = Number.parseInt(request.body?.ordre ?? "", 10);
      const change = await modifierExercice(
        ecoleId,
        id,
        valide.valeur,
        Number.isFinite(ordre) && ordre >= 0 ? ordre : 0,
      );
      if (!change) return reply.code(404).type("text/html").send(await introuvable(request));

      return reply.type("text/html").send(
        await pageExercices(ecoleId, { ton: "ok", texte: "Exercice enregistré." }),
      );
    },
  );

  app.post<{ Params: { id: string }; Body: { publie?: string } }>(
    "/cours/exercices/:id/publier",
    async (request, reply) => {
      const ecoleId = ecoleDe(request);
      const publie = request.body?.publie === "oui";
      const change = await publierExercice(ecoleId, request.params.id, publie);
      if (!change) return reply.code(404).type("text/html").send(await introuvable(request));

      return reply.type("text/html").send(
        await pageExercices(ecoleId, {
          ton: "ok",
          texte: publie
            ? "Exercice publié : vos élèves le voient."
            : "Exercice retiré de la liste de vos élèves. Leurs réponses sont conservées.",
        }),
      );
    },
  );

  app.post<{ Params: { id: string } }>(
    "/cours/exercices/:id/supprimer",
    async (request, reply) => {
      const ecoleId = ecoleDe(request);
      /*
       * Le message dit ce qui s'est réellement passé. Annoncer « supprimé »
       * quand rien ne l'a été — l'exercice avait déjà disparu, ou n'a jamais
       * été de cette école — apprend au responsable à ne plus croire ses
       * confirmations.
       */
      const fait = await supprimerExercice(ecoleId, request.params.id);
      return reply
        .code(fait ? 200 : 404)
        .type("text/html")
        .send(
          await pageExercices(
            ecoleId,
            fait
              ? { ton: "ok", texte: "Exercice supprimé." }
              : { ton: "ko", texte: "Cet exercice n'existe plus." },
          ),
        );
    },
  );

  /* --- Élèves ------------------------------------------------------------ */

  app.get("/cours/eleves", async (request, reply) =>
    reply.type("text/html").send(await pageEleves(ecoleDe(request))),
  );

  app.post<{ Body: { prenom?: string; nom?: string; email?: string } }>(
    "/cours/eleves",
    async (request, reply) => {
      const ecoleId = ecoleDe(request);
      const prenom = (request.body?.prenom ?? "").trim();
      const nom = (request.body?.nom ?? "").trim();
      const email = (request.body?.email ?? "").trim().toLowerCase();

      const refus = async (texte: string): Promise<FastifyReply> =>
        reply.code(400).type("text/html").send(await pageEleves(ecoleId, { ton: "ko", texte }));

      if (prenom === "") return refus("Il faut au moins un prénom.");
      if (!emailValide(email)) return refus("Cette adresse e-mail ne semble pas valide.");

      const jeton = jetonInvitation();
      const pose = await inviterEleve(
        ecoleId,
        { prenom: prenom.slice(0, 80), nom: nom.slice(0, 80), email },
        jeton,
        finInvitation(),
      );
      if (!pose.ok) {
        return reply
          .code(409)
          .type("text/html")
          .send(await pageEleves(ecoleId, { ton: "ko", texte: pose.raison }));
      }

      const ecole = await lireEcole(ecoleId);
      const lien = lienInvitation(request, jeton);
      await envoyerInvitation(email, prenom, ecole?.nom ?? "votre école", lien);

      return reply.type("text/html").send(
        await pageEleves(
          ecoleId,
          { ton: "ok", texte: `${prenom} est invité.` },
          { nom: nomComplet({ prenom, nom }), lien },
        ),
      );
    },
  );

  app.get<{ Params: { id: string } }>("/cours/eleves/:id", async (request, reply) => {
    const page = await pageEleve(ecoleDe(request), request.params.id);
    if (!page) return reply.code(404).type("text/html").send(await introuvable(request));
    return reply.type("text/html").send(page);
  });

  app.post<{ Params: { id: string }; Body: { exercice?: string; du_le?: string } }>(
    "/cours/eleves/:id/devoirs",
    async (request, reply) => {
      const ecoleId = ecoleDe(request);
      const { id } = request.params;
      const exercice = (request.body?.exercice ?? "").trim();

      const pose = await poserDevoir(ecoleId, id, exercice, dateDeRemise(request.body?.du_le));
      const page = await pageEleve(
        ecoleId,
        id,
        pose
          ? { ton: "ok", texte: "Devoir donné. Il apparaît en tête de sa liste." }
          : { ton: "ko", texte: "Cet exercice ou cet élève n'existe pas." },
      );
      if (!page) return reply.code(404).type("text/html").send(await introuvable(request));
      return reply.code(pose ? 200 : 404).type("text/html").send(page);
    },
  );

  app.post<{ Params: { id: string; exercice: string } }>(
    "/cours/eleves/:id/devoirs/:exercice/retirer",
    async (request, reply) => {
      const ecoleId = ecoleDe(request);
      const { id, exercice } = request.params;
      const fait = await retirerDevoir(ecoleId, id, exercice);
      const page = await pageEleve(
        ecoleId,
        id,
        fait
          ? { ton: "ok", texte: "Devoir retiré." }
          : { ton: "ko", texte: "Ce devoir n'existe plus." },
      );
      if (!page) return reply.code(404).type("text/html").send(await introuvable(request));
      return reply.type("text/html").send(page);
    },
  );

  app.post<{
    Params: { id: string; exercice: string };
    Body: { correction?: string; appreciation?: string };
  }>("/cours/eleves/:id/travaux/:exercice/corriger", async (request, reply) => {
    const ecoleId = ecoleDe(request);
    const { id, exercice } = request.params;
    const appreciation = request.body?.appreciation === "acquis" ? "acquis" : "a_revoir";

    const fait = await corrigerTravail(
      ecoleId,
      id,
      exercice,
      (request.body?.correction ?? "").trim(),
      appreciation,
    );
    const page = await pageEleve(
      ecoleId,
      id,
      fait
        ? { ton: "ok", texte: "Correction enregistrée. Il la voit tout de suite." }
        : { ton: "ko", texte: "Ce travail n'a pas été rendu, il n'y a rien à corriger." },
    );
    if (!page) return reply.code(404).type("text/html").send(await introuvable(request));
    return reply.type("text/html").send(page);
  });

  app.post<{ Params: { id: string } }>(
    "/cours/eleves/:id/inviter",
    async (request, reply) => {
      const ecoleId = ecoleDe(request);
      const { id } = request.params;
      const jeton = jetonInvitation();
      const eleve = await renouvelerInvitation(ecoleId, id, jeton, finInvitation());
      if (!eleve) {
        const page = await pageEleve(ecoleId, id, {
          ton: "ko",
          texte: "Cet élève a déjà choisi son mot de passe : son invitation ne sert plus.",
        });
        return reply.code(409).type("text/html").send(page ?? (await introuvable(request)));
      }

      const ecole = await lireEcole(ecoleId);
      const lien = lienInvitation(request, jeton);
      await envoyerInvitation(eleve.email, eleve.prenom, ecole?.nom ?? "votre école", lien);

      const page = await pageEleve(
        ecoleId,
        id,
        { ton: "ok", texte: "Invitation renvoyée." },
        lien,
      );
      return reply.type("text/html").send(page ?? (await introuvable(request)));
    },
  );

  app.post<{ Params: { id: string } }>(
    "/cours/eleves/:id/retirer",
    async (request, reply) => {
      const ecoleId = ecoleDe(request);
      const fait = await retirerEleve(ecoleId, request.params.id);
      return reply
        .code(fait ? 200 : 404)
        .type("text/html")
        .send(
          await pageEleves(
            ecoleId,
            fait
              ? { ton: "ok", texte: "Élève retiré." }
              : { ton: "ko", texte: "Cet élève n'existe plus." },
          ),
        );
    },
  );

  /* --- Compte ------------------------------------------------------------ */

  app.get("/cours/mot-de-passe", async (request, reply) =>
    reply.type("text/html").send(await pageCompte(ecoleDe(request))),
  );

  app.post<{ Body: { actif?: string } }>("/cours/classement", async (request, reply) => {
    const ecoleId = ecoleDe(request);
    const actif = request.body?.actif === "oui";
    await basculerClassement(ecoleId, actif);
    return reply.type("text/html").send(
      await pageCompte(ecoleId, {
        ton: "ok",
        texte: actif
          ? "Classement allumé. Vos élèves le voient dès leur prochaine page."
          : "Classement éteint.",
      }),
    );
  });

  app.post<{ Body: { nom?: string } }>("/cours/nom", async (request, reply) => {
    const ecoleId = ecoleDe(request);
    const nom = (request.body?.nom ?? "").trim();
    if (nom === "" || nom.length > 120) {
      return reply
        .code(400)
        .type("text/html")
        .send(await pageCompte(ecoleId, { ton: "ko", texte: "Ce nom ne convient pas." }));
    }
    await renommerEcole(ecoleId, nom);
    return reply
      .type("text/html")
      .send(await pageCompte(ecoleId, { ton: "ok", texte: "Nom enregistré." }));
  });

  app.post<{ Body: { actuel?: string; nouveau?: string; confirmation?: string } }>(
    "/cours/mot-de-passe",
    {
      // Un mot de passe actuel se devine par essais successifs si on laisse
      // essayer.
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    },
    async (request, reply) => {
      const u = utilisateur(request);
      const ecoleId = ecoleDuResponsable(u);
      const { actuel = "", nouveau = "", confirmation = "" } = request.body ?? {};

      const refus = async (texte: string): Promise<FastifyReply> =>
        reply.code(400).type("text/html").send(await pageCompte(ecoleId, { ton: "ko", texte }));

      if (nouveau.length < 12) {
        return refus("Le nouveau mot de passe doit faire au moins douze caractères.");
      }
      if (nouveau !== confirmation) {
        return refus("Les deux nouveaux mots de passe ne sont pas identiques.");
      }

      const compte = await findAdminById(u.id);
      if (!compte || !(await verifyPassword(actuel, compte.password_hash))) {
        return refus("Le mot de passe actuel est incorrect.");
      }

      await changerMotDePasse(compte.id, await hashPassword(nouveau));
      return reply
        .type("text/html")
        .send(await pageCompte(ecoleId, { ton: "ok", texte: "Mot de passe modifié." }));
    },
  );
}

/* -------------------------------------------------------------------------- */

/**
 * La page « introuvable » de l'espace de cours.
 *
 * Elle dit la même chose pour un identifiant inexistant et pour celui d'une
 * autre école : c'est volontaire, sinon la différence entre les deux réponses
 * apprendrait à un responsable curieux quels identifiants existent ailleurs.
 */
async function introuvable(request: FastifyRequest): Promise<string> {
  const ecole = await lireEcole(ecoleDuResponsable(utilisateur(request)));
  return layoutEcole(
    "Introuvable",
    `<h1>Introuvable</h1>
<p class="chapeau">Cette page n'existe pas, ou plus.</p>
<p><a href="/cours">← Revenir à mon espace</a></p>`,
    { nom: ecole?.nom },
  );
}

/**
 * L'invitation, écrite comme on l'écrirait à la main.
 *
 * En texte seul : elle est lue sur un téléphone, souvent par quelqu'un qui
 * n'attendait rien, et un message qui ressemble à une publicité finit dans les
 * indésirables. Le nom de l'école est en tête parce que c'est le seul mot qui
 * fera reconnaître l'expéditeur.
 */
async function envoyerInvitation(
  email: string,
  prenom: string,
  nomEcole: string,
  lien: string,
): Promise<void> {
  await sendMail({
    to: email,
    subject: `${nomEcole} vous invite à son espace de cours`,
    text: `Bonjour ${prenom},

${nomEcole} vous ouvre un espace où retrouver vos exercices, les faire dans
l'ordre que vous voulez, et voir les corrections de votre professeur.

Choisissez votre mot de passe ici :
${lien}

Ce lien vaut ${INVITATION_JOURS} jours et ne sert qu'une fois.

Si vous ne savez pas de quoi il s'agit, ignorez ce message : aucun compte ne
sera ouvert sans que vous cliquiez.
`,
  });
}

export { INVITATION_JOURS, jetonInvitation, finInvitation, lienInvitation };
