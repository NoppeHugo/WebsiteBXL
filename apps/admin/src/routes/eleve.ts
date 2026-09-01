import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config, isProduction } from "../config.ts";
import { hashPassword, verifyPassword, signSession } from "../auth.ts";
import { utilisateur, ecoleDeLEleve } from "../acces.ts";
import {
  ecole as lireEcole,
  eleveParId,
  eleveParInvitation,
  activerEleve,
  changerMotDePasseEleve,
  exercicesOuverts,
  exerciceOuvert,
  travauxDeLEleve,
  travailDeLEleve,
  enregistrerTravail,
  devoirsDeLEleve,
  resumeDesEleves,
  statsDeLEleve,
  jourCourant,
} from "../db-ecole.ts";
import {
  avancement,
  enRetard,
  etatDuTravail,
  invitationOuverte,
  lienPresentable,
  nomComplet,
  type Exercice,
} from "../ecole.ts";
import {
  BAREME,
  hautsFaits,
  niveauDe,
  nouveauxHautsFaits,
  points,
  semaine,
  serie,
  type HautFait,
  type StatsEleve,
} from "../jeu.ts";
import { escape } from "../views.ts";
import {
  layoutEcole,
  message,
  tableauDeBord,
  grilleHautsFaits,
  carteExercice,
  carte,
  classement,
  copie,
  dateLisible,
  puce,
  puceEcheance,
  puceEtat,
  type LigneClassement,
} from "../views-ecole.ts";
import { SESSION_COOKIE } from "./auth.ts";

/**
 * L'espace de l'élève.
 *
 * ─── Ce que cette page refuse de faire ────────────────────────────────────
 *
 * Elle ne verrouille rien. Tous les exercices publiés sont ouverts, tout le
 * temps, dans n'importe quel ordre — pas de progression à débloquer, pas
 * d'exercice grisé tant que le précédent n'est pas rendu.
 *
 * Ce n'est pas une simplification : c'est ce que fait un élève réel. Quelqu'un
 * qui révise son code de la route trois soirs par semaine retravaille ce qu'il
 * a raté, pas ce qui vient après. Un parcours imposé l'aurait obligé à refaire
 * ce qu'il sait déjà pour atteindre ce qu'il cherche, et il aurait fermé
 * l'onglet.
 *
 * ─── Ce que le jeu ajoute, et ce qu'il ne remplace pas ────────────────────
 *
 * Points, niveau, série et hauts faits donnent une raison de revenir un
 * mercredi soir sans que personne ne le demande. Ils ne décident de rien :
 * aucun exercice ne s'ouvre parce qu'on a assez de points, et le professeur
 * garde la main sur ce qui compte — ce qui est publié, ce qui est dû, et ce
 * qui est acquis. Le barème est affiché en clair sur la page de progression,
 * parce qu'un barème secret transforme chaque total en discussion.
 */

type Flash = { ton: "ok" | "ko"; texte: string };

/* -------------------------------------------------------------------------- */
/* Ce que l'élève a gagné                                                     */
/* -------------------------------------------------------------------------- */

interface Jeu {
  stats: StatsEleve;
  points: number;
  niveau: ReturnType<typeof niveauDe>;
  serie: number;
  semaine: ReturnType<typeof semaine>;
  faits: HautFait[];
}

/** Une seule lecture, un seul calcul : toutes les pages en tirent la même chose. */
async function jeuDe(eleveId: number, ecoleId: string): Promise<Jeu> {
  const [brut, jour] = await Promise.all([statsDeLEleve(eleveId, ecoleId), jourCourant()]);
  const stats: StatsEleve = brut;
  const enCours = serie(stats.jours, jour);
  const pts = points(stats);

  return {
    stats,
    points: pts,
    niveau: niveauDe(pts),
    serie: enCours,
    semaine: semaine(stats.jours, jour),
    faits: hautsFaits(stats, enCours),
  };
}

/* -------------------------------------------------------------------------- */
/* Accueil                                                                    */
/* -------------------------------------------------------------------------- */

async function pageAccueil(
  eleveId: number,
  flash?: Flash,
  gagnes: HautFait[] = [],
): Promise<string | undefined> {
  const eleve = await eleveParId(eleveId);
  if (!eleve) return undefined;

  const [ecole, exercices, travaux, devoirs, jeu] = await Promise.all([
    lireEcole(Number(eleve.ecole_id)),
    exercicesOuverts(eleve.ecole_id),
    travauxDeLEleve(eleve.id),
    devoirsDeLEleve(eleve.id),
    jeuDe(eleveId, eleve.ecole_id),
  ]);

  const parExercice = new Map(travaux.map((t) => [String(t.exercice_id), t]));
  const devoirDe = new Map(devoirs.map((d) => [String(d.exercice_id), d]));
  const etatDe = (x: Exercice) => etatDuTravail(parExercice.get(String(x.id)));

  const ligne = (x: Exercice) => {
    const etat = etatDe(x);
    const devoir = devoirDe.get(String(x.id));
    const retard = devoir ? enRetard(devoir.du_le, etat) : false;
    const puces = [
      x.matiere ? puce(x.matiere, "matiere") : "",
      devoir ? puceEcheance(devoir.du_le, retard) : puceEtat(etat),
    ].filter(Boolean);

    return carteExercice({
      href: `/eleve/exercice/${x.id}`,
      titre: x.titre,
      etat,
      puces,
      retard,
    });
  };

  const aFaire = exercices.filter((x) => devoirDe.has(String(x.id)));
  const reste = exercices.filter((x) => !devoirDe.has(String(x.id)));
  const aRevoir = exercices.filter((x) => etatDe(x) === "a-revoir");

  return layoutEcole(
    ecole?.nom ?? "Mes exercices",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Bonjour ${escape(eleve.prenom)}</h1>

${tableauDeBord({
  avancement: avancement(exercices.map(etatDe)),
  niveau: jeu.niveau,
  points: jeu.points,
  serie: jeu.serie,
  semaine: jeu.semaine,
})}

${
  gagnes.length > 0
    ? `<div class="etat" data-ton="fete">
  <b>${gagnes.length > 1 ? "Nouveaux hauts faits" : "Nouveau haut fait"} !</b>
  <span>${gagnes.map((h) => `${h.emoji} ${escape(h.nom)}`).join(" · ")}</span>
  <a class="etat__lien" href="/eleve/progression">Voir ma progression →</a>
</div>`
    : ""
}

${
  aRevoir.length > 0
    ? `<div class="etat" data-ton="alerte">
  <b>${aRevoir.length} exercice${aRevoir.length > 1 ? "s" : ""} à revoir</b>
  <span>Votre professeur vous a répondu et attend une seconde version.</span>
</div>`
    : ""
}

<h2>À faire pour votre professeur</h2>
${
  aFaire.length === 0
    ? `<p class="vide">Aucun devoir. Piochez ce que vous voulez plus bas.</p>`
    : `<div class="exos">${aFaire.map(ligne).join("")}</div>`
}

<h2>Tous les exercices</h2>
${
  reste.length === 0
    ? `<p class="vide">${
        exercices.length === 0
          ? "Votre professeur n'a pas encore publié d'exercice."
          : "Tous vos exercices sont dans vos devoirs."
      }</p>`
    : `<div class="exos">${reste.map(ligne).join("")}</div>`
}

<h2>Mon espace</h2>
<div class="menu">
  ${carte({
    href: "/eleve/progression",
    icone: "🏅",
    titre: "Ma progression",
    sous: "Mes hauts faits et comment les points se gagnent",
    compte: jeu.faits.filter((h) => h.obtenu).length,
  })}
  ${
    ecole?.classement
      ? carte({
          href: "/eleve/classement",
          icone: "🏆",
          titre: "Le classement",
          sous: "Où j'en suis par rapport à la classe",
        })
      : ""
  }
  ${carte({
    href: "/eleve/mot-de-passe",
    icone: "🔑",
    titre: "Mon mot de passe",
    sous: "En choisir un autre",
  })}
</div>`,
    { nom: ecole?.nom },
  );
}

/* -------------------------------------------------------------------------- */
/* Progression                                                                */
/* -------------------------------------------------------------------------- */

async function pageProgression(eleveId: number): Promise<string | undefined> {
  const eleve = await eleveParId(eleveId);
  if (!eleve) return undefined;

  const [ecole, jeu] = await Promise.all([
    lireEcole(Number(eleve.ecole_id)),
    jeuDe(eleveId, eleve.ecole_id),
  ]);
  const obtenus = jeu.faits.filter((h) => h.obtenu).length;

  return layoutEcole(
    "Ma progression",
    `<h1>Ma progression</h1>
<p class="chapeau">
  ${obtenus} haut${obtenus > 1 ? "s" : ""} fait${obtenus > 1 ? "s" : ""} sur ${jeu.faits.length},
  ${jeu.points} point${jeu.points > 1 ? "s" : ""}, niveau ${jeu.niveau.rang}.
</p>

${tableauDeBord({
  avancement: { rendus: jeu.stats.rendus, total: jeu.stats.total, pourcentage:
    jeu.stats.total === 0 ? 0 : Math.round((jeu.stats.rendus / jeu.stats.total) * 100) },
  niveau: jeu.niveau,
  points: jeu.points,
  serie: jeu.serie,
  semaine: jeu.semaine,
})}

<h2>Mes hauts faits</h2>
${grilleHautsFaits(jeu.faits)}

<h2>Comment les points se gagnent</h2>
<div class="fiche">
  <div class="fiche__detail">
    <b>+${BAREME.rendu}</b> pour un exercice rendu.<br>
    <b>+${BAREME.acquis}</b> quand votre professeur le marque « acquis ».<br>
    <b>+${BAREME.aLHeure}</b> pour un devoir rendu avant sa date.
  </div>
  <p class="fiche__detail" style="margin:0.7rem 0 0">
    Rien ne s'obtient en ouvrant l'application : seuls les exercices rendus
    comptent, et la série ne compte que les jours où vous avez rendu quelque
    chose.
  </p>
</div>

<h2>Les paliers</h2>
<div class="fiche">
  <div class="fiche__detail">
    ${[
      "Premiers pas — 0",
      "En route — 60",
      "Régulier — 150",
      "Solide — 300",
      "Aguerri — 520",
      "Chevronné — 820",
      "Maître — 1200",
    ]
      .map((l, i) => `${i + 1 === jeu.niveau.rang ? `<b>${l} ← vous</b>` : l}`)
      .join("<br>")}
  </div>
</div>`,
    { nom: ecole?.nom, retour: "/eleve" },
  );
}

/* -------------------------------------------------------------------------- */
/* Classement                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Le classement de la classe, quand le responsable l'a allumé.
 *
 * Les prénoms et l'initiale du nom : une classe se reconnaît entre elle sans
 * qu'une liste de noms complets circule. Éteint, la page répond comme si elle
 * n'existait pas — un élève n'a pas à découvrir qu'un classement existe et lui
 * est refusé.
 */
async function pageClassement(eleveId: number): Promise<string | undefined> {
  const eleve = await eleveParId(eleveId);
  if (!eleve) return undefined;

  const ecole = await lireEcole(Number(eleve.ecole_id));
  if (!ecole?.classement) return undefined;

  const [eleves, jour] = await Promise.all([
    resumeDesEleves(Number(eleve.ecole_id)),
    jourCourant(),
  ]);

  const lignes: LigneClassement[] = eleves
    .map((e) => {
      const pts = points({ rendus: e.rendus, acquis: e.acquis, aLHeure: e.a_lheure });
      return {
        id: e.id,
        nom: `${e.prenom} ${e.nom.charAt(0).toUpperCase()}${e.nom ? "." : ""}`.trim(),
        points: pts,
        niveau: niveauDe(pts).nom,
        moi: String(e.id) === String(eleve.id),
      };
    })
    .sort((a, b) => b.points - a.points || a.nom.localeCompare(b.nom, "fr"));

  const moi = lignes.findIndex((l) => l.moi) + 1;

  return layoutEcole(
    "Le classement",
    `<h1>Le classement</h1>
<p class="chapeau">
  ${
    lignes.length <= 1
      ? "Vous êtes seul dans la classe pour l'instant."
      : moi > 0
        ? `Vous êtes ${moi === 1 ? "en tête" : `${moi}<sup>e</sup>`} sur ${lignes.length}.`
        : `${lignes.length} élèves.`
  }
  Les points viennent du travail rendu, pas du temps passé.
</p>

${classement(lignes)}

<p class="aide">
  Ce classement est visible parce que votre professeur l'a allumé. Il ne change
  rien à ce que vous pouvez faire : tous les exercices restent ouverts à tout
  le monde.
</p>`,
    { nom: ecole.nom, retour: "/eleve" },
  );
}

/* -------------------------------------------------------------------------- */
/* Un exercice                                                                */
/* -------------------------------------------------------------------------- */

async function pageExercice(
  eleveId: number,
  exerciceId: string,
  flash?: Flash,
): Promise<string | undefined> {
  const eleve = await eleveParId(eleveId);
  if (!eleve) return undefined;

  const x = await exerciceOuvert(eleve.ecole_id, exerciceId);
  if (!x) return undefined;

  const [ecole, travail, devoirs] = await Promise.all([
    lireEcole(Number(eleve.ecole_id)),
    travailDeLEleve(eleveId, exerciceId),
    devoirsDeLEleve(eleve.id),
  ]);

  const etat = etatDuTravail(travail);
  const devoir = devoirs.find((d) => String(d.exercice_id) === String(x.id));
  const lien = lienPresentable(x.lien);

  return layoutEcole(
    x.titre,
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>${escape(x.titre)}</h1>

<div class="fiche__puces" style="margin-bottom:1.2rem">
  ${x.matiere ? puce(x.matiere, "matiere") : ""}
  ${puceEtat(etat)}
  ${devoir ? puceEcheance(devoir.du_le, enRetard(devoir.du_le, etat)) : ""}
</div>

${x.consigne.trim() !== "" ? copie(x.consigne, "professeur") : ""}

${
  lien
    ? `<p style="margin-top:1rem"><a href="${escape(lien)}" target="_blank" rel="noopener noreferrer">
    Ouvrir la ressource →</a></p>`
    : ""
}

${
  travail?.correction
    ? `<h2>La réponse de votre professeur</h2>
       ${copie(travail.correction, "professeur")}
       <p class="aide">${
         etat === "a-revoir"
           ? "Reprenez votre réponse ci-dessous et rendez-la à nouveau."
           : "Exercice acquis."
       }</p>`
    : ""
}

<h2>Ma réponse</h2>
<form method="post" action="/eleve/exercice/${escape(x.id)}">
  <label>Ce que vous répondez
    <textarea name="reponse" rows="8">${escape(travail?.reponse ?? "")}</textarea>
  </label>
  <div class="actions">
    <button type="submit" name="action" value="rendre">
      ${travail?.statut === "rendu" ? "Rendre à nouveau" : "J'ai terminé"}
    </button>
    <button type="submit" name="action" value="brouillon" class="second">
      Garder pour plus tard
    </button>
  </div>
</form>
<p class="aide">
  « Garder pour plus tard » enregistre sans prévenir votre professeur, et ne
  compte pas dans votre série : seul ce qui est rendu compte.
</p>`,
    { nom: ecole?.nom, retour: "/eleve" },
  );
}

/* -------------------------------------------------------------------------- */
/* Mot de passe                                                               */
/* -------------------------------------------------------------------------- */

async function pageMotDePasse(eleveId: number, flash?: Flash): Promise<string> {
  const eleve = await eleveParId(eleveId);
  const ecole = eleve ? await lireEcole(Number(eleve.ecole_id)) : undefined;

  return layoutEcole(
    "Mon mot de passe",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Changer mon mot de passe</h1>
<p class="chapeau">Au moins dix caractères.</p>

<form method="post" action="/eleve/mot-de-passe">
  <label>Mot de passe actuel
    <input type="password" name="actuel" required autocomplete="current-password">
  </label>
  <label>Nouveau mot de passe
    <input type="password" name="nouveau" required minlength="10" autocomplete="new-password">
  </label>
  <label>Le même, pour être sûr
    <input type="password" name="confirmation" required minlength="10" autocomplete="new-password">
  </label>
  <div class="actions"><button type="submit">Enregistrer</button></div>
</form>`,
    { nom: ecole?.nom, retour: "/eleve" },
  );
}

/* -------------------------------------------------------------------------- */
/* Invitation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * La page d'accueil d'un élève invité, avant qu'il n'ait de compte.
 *
 * Publique par nécessité : il n'a rien à donner pour prouver qui il est, sinon
 * le jeton qu'il porte dans l'adresse. C'est pourquoi ce jeton est tiré au
 * sort sur 24 octets, périme au bout de deux semaines, et disparaît dès qu'il
 * a servi.
 */
function pageInvitation(
  jeton: string,
  nomEcole: string,
  prenom: string,
  erreur?: string,
): string {
  return layoutEcole(
    "Votre espace de cours",
    `<div class="connexion">
<h1>Bienvenue ${escape(prenom)}</h1>
<p class="chapeau">
  ${escape(nomEcole)} vous ouvre un espace de cours. Choisissez un mot de passe :
  il sera le vôtre, personne d'autre ne le connaîtra.
</p>

${erreur ? message("ko", erreur) : ""}

<form method="post" action="/invitation/${escape(jeton)}">
  <label>Mot de passe
    <input type="password" name="motdepasse" required minlength="10" autocomplete="new-password">
  </label>
  <label>Le même, pour être sûr
    <input type="password" name="confirmation" required minlength="10" autocomplete="new-password">
  </label>
  <div class="actions"><button type="submit">Entrer</button></div>
</form>
</div>`,
  );
}

function pageInvitationPerimee(): string {
  return layoutEcole(
    "Invitation expirée",
    `<div class="connexion">
<h1>Cette invitation ne vaut plus</h1>
<p class="chapeau">
  Elle a peut-être déjà servi, ou dépassé ses deux semaines. Demandez à votre
  professeur de vous en renvoyer une : cela lui prend un clic.
</p>
<p><a href="/login">Se connecter</a></p>
</div>`,
  );
}

function pageIntrouvable(): string {
  return layoutEcole(
    "Introuvable",
    `<h1>Introuvable</h1>
<p class="chapeau">Cette page n'existe pas, ou votre professeur l'a retirée.</p>
<p><a href="/eleve">← Revenir à mes exercices</a></p>`,
  );
}

/* -------------------------------------------------------------------------- */

export function eleveRoutes(app: FastifyInstance): void {
  const idDe = (request: FastifyRequest) => {
    const u = utilisateur(request);
    // Lève si ce n'est pas un élève : la vérification est dans `acces.ts`, et
    // elle est la même pour toutes les routes de cette zone.
    ecoleDeLEleve(u);
    return u.id;
  };

  app.get("/eleve", async (request, reply) => {
    const page = await pageAccueil(idDe(request));
    if (!page) return reply.code(404).type("text/html").send(pageIntrouvable());
    return reply.type("text/html").send(page);
  });

  app.get("/eleve/progression", async (request, reply) => {
    const page = await pageProgression(idDe(request));
    if (!page) return reply.code(404).type("text/html").send(pageIntrouvable());
    return reply.type("text/html").send(page);
  });

  app.get("/eleve/classement", async (request, reply) => {
    const page = await pageClassement(idDe(request));
    // Classement éteint : la page n'existe pas, plutôt qu'un refus qui
    // apprendrait à l'élève qu'elle existe ailleurs.
    if (!page) return reply.code(404).type("text/html").send(pageIntrouvable());
    return reply.type("text/html").send(page);
  });

  app.get<{ Params: { id: string } }>(
    "/eleve/exercice/:id",
    async (request, reply) => {
      const page = await pageExercice(idDe(request), request.params.id);
      if (!page) return reply.code(404).type("text/html").send(pageIntrouvable());
      return reply.type("text/html").send(page);
    },
  );

  app.post<{ Params: { id: string }; Body: { reponse?: string; action?: string } }>(
    "/eleve/exercice/:id",
    async (request, reply) => {
      const eleveId = idDe(request);
      const eleve = await eleveParId(eleveId);
      if (!eleve) return reply.code(404).type("text/html").send(pageIntrouvable());

      const rendre = request.body?.action === "rendre";
      const reponse = (request.body?.reponse ?? "").trim();

      /*
       * Rendre une réponse vide n'est pas un accident à corriger poliment : le
       * professeur verrait « rendu » et ouvrirait une page blanche. Un
       * brouillon vide, en revanche, est légitime — c'est ce qu'on enregistre
       * quand on efface tout pour recommencer.
       */
      if (rendre && reponse === "") {
        const page = await pageExercice(eleveId, request.params.id, {
          ton: "ko",
          texte: "Écrivez quelque chose avant de rendre.",
        });
        return reply.code(400).type("text/html").send(page ?? pageIntrouvable());
      }

      // Relevé avant l'écriture : c'est la comparaison des deux qui dit ce qui
      // vient d'être décroché, et permet de le fêter au bon moment.
      const avant = rendre ? (await jeuDe(eleveId, eleve.ecole_id)).faits : [];

      const fait = await enregistrerTravail(
        { id: eleveId, ecole_id: eleve.ecole_id },
        request.params.id,
        reponse,
        rendre,
      );
      if (!fait) return reply.code(404).type("text/html").send(pageIntrouvable());

      const gagnes = rendre
        ? nouveauxHautsFaits(avant, (await jeuDe(eleveId, eleve.ecole_id)).faits)
        : [];

      const page = await pageAccueil(
        eleveId,
        {
          ton: "ok",
          texte: rendre
            ? `Rendu. +${BAREME.rendu} points.`
            : "Enregistré. Vous pourrez reprendre plus tard.",
        },
        gagnes,
      );
      return reply.type("text/html").send(page ?? pageIntrouvable());
    },
  );

  app.get("/eleve/mot-de-passe", async (request, reply) =>
    reply.type("text/html").send(await pageMotDePasse(idDe(request))),
  );

  app.post<{ Body: { actuel?: string; nouveau?: string; confirmation?: string } }>(
    "/eleve/mot-de-passe",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const eleveId = idDe(request);
      const { actuel = "", nouveau = "", confirmation = "" } = request.body ?? {};

      const refus = async (texte: string): Promise<FastifyReply> =>
        reply
          .code(400)
          .type("text/html")
          .send(await pageMotDePasse(eleveId, { ton: "ko", texte }));

      if (nouveau.length < 10) {
        return refus("Le nouveau mot de passe doit faire au moins dix caractères.");
      }
      if (nouveau !== confirmation) {
        return refus("Les deux nouveaux mots de passe ne sont pas identiques.");
      }

      const eleve = await eleveParId(eleveId);
      if (!eleve?.password_hash || !(await verifyPassword(actuel, eleve.password_hash))) {
        return refus("Le mot de passe actuel est incorrect.");
      }

      await changerMotDePasseEleve(eleveId, await hashPassword(nouveau));
      const page = await pageAccueil(eleveId, { ton: "ok", texte: "Mot de passe modifié." });
      return reply.type("text/html").send(page ?? pageIntrouvable());
    },
  );

  /* --- Invitation, hors session ----------------------------------------- */

  app.get<{ Params: { jeton: string } }>(
    "/invitation/:jeton",
    { config: { rateLimit: { max: 30, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const eleve = await eleveParInvitation(request.params.jeton);
      if (!eleve || !invitationOuverte(eleve)) {
        return reply.code(410).type("text/html").send(pageInvitationPerimee());
      }
      const ecole = await lireEcole(Number(eleve.ecole_id));
      return reply
        .type("text/html")
        .send(pageInvitation(request.params.jeton, ecole?.nom ?? "Votre école", eleve.prenom));
    },
  );

  app.post<{ Params: { jeton: string }; Body: { motdepasse?: string; confirmation?: string } }>(
    "/invitation/:jeton",
    {
      // Un jeton se devine par force brute si on laisse essayer : 24 octets
      // tirés au sort n'y suffiraient pas seuls le jour où l'on en émet des
      // milliers.
      config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
    },
    async (request, reply) => {
      const { jeton } = request.params;
      const eleve = await eleveParInvitation(jeton);
      if (!eleve || !invitationOuverte(eleve)) {
        return reply.code(410).type("text/html").send(pageInvitationPerimee());
      }

      const ecole = await lireEcole(Number(eleve.ecole_id));
      const motdepasse = request.body?.motdepasse ?? "";
      const confirmation = request.body?.confirmation ?? "";

      const refus = (texte: string): FastifyReply =>
        reply
          .code(400)
          .type("text/html")
          .send(pageInvitation(jeton, ecole?.nom ?? "Votre école", eleve.prenom, texte));

      if (motdepasse.length < 10) {
        return refus("Le mot de passe doit faire au moins dix caractères.");
      }
      if (motdepasse !== confirmation) {
        return refus("Les deux mots de passe ne sont pas identiques.");
      }

      await activerEleve(eleve.id, await hashPassword(motdepasse));

      /*
       * Connecté dans la foulée : il vient de prouver qu'il détient le lien et
       * de choisir un mot de passe. Le renvoyer vers la page de connexion pour
       * le retaper aussitôt, c'est perdre la moitié des élèves au premier
       * écran.
       */
      const token = signSession(
        {
          userId: Number(eleve.id),
          expiresAt: Date.now() + config.SESSION_HOURS * 3600_000,
          qui: "eleve",
        },
        config.SESSION_SECRET,
      );

      return reply
        .setCookie(SESSION_COOKIE, token, {
          httpOnly: true,
          sameSite: "strict",
          secure: isProduction,
          path: "/",
          maxAge: config.SESSION_HOURS * 3600,
        })
        .redirect("/eleve", 303);
    },
  );
}

export { jeuDe, nomComplet, dateLisible };
