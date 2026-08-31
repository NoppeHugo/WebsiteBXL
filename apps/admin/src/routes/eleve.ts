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
} from "../db-ecole.ts";
import {
  avancement,
  enRetard,
  etatDuTravail,
  invitationOuverte,
  lienPresentable,
  type Exercice,
  type EtatTravail,
} from "../ecole.ts";
import { escape } from "../views.ts";
import { message, dateLisible } from "../views-client.ts";
import { layoutEcole, carte, copie, etiquette, jauge } from "../views-ecole.ts";
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
 * Le seul ordre qui existe est celui que son professeur lui donne : les
 * devoirs, en tête de liste, avec leur date.
 */

type Flash = { ton: "ok" | "ko"; texte: string };

/** Le pictogramme d'un état : reconnu avant d'être lu, dans une liste de vingt. */
const ICONE: Record<EtatTravail, string> = {
  "a-faire": "⚪️",
  commence: "✏️",
  rendu: "📨",
  acquis: "✅",
  "a-revoir": "🔁",
};

/* -------------------------------------------------------------------------- */
/* Accueil                                                                    */
/* -------------------------------------------------------------------------- */

async function pageAccueil(eleveId: number, flash?: Flash): Promise<string | undefined> {
  const eleve = await eleveParId(eleveId);
  if (!eleve) return undefined;

  const [ecole, exercices, travaux, devoirs] = await Promise.all([
    lireEcole(Number(eleve.ecole_id)),
    exercicesOuverts(eleve.ecole_id),
    travauxDeLEleve(eleve.id),
    devoirsDeLEleve(eleve.id),
  ]);

  const parExercice = new Map(travaux.map((t) => [String(t.exercice_id), t]));
  const devoirDe = new Map(devoirs.map((d) => [String(d.exercice_id), d]));
  const etatDe = (x: Exercice) => etatDuTravail(parExercice.get(String(x.id)));
  const av = avancement(exercices.map(etatDe));

  const ligne = (x: Exercice) => {
    const etat = etatDe(x);
    const devoir = devoirDe.get(String(x.id));
    const retard = devoir ? enRetard(devoir.du_le, etat) : false;
    const sous = [
      x.matiere ?? "",
      devoir?.du_le
        ? retard
          ? `En retard depuis le ${dateLisible(devoir.du_le)}`
          : `Pour le ${dateLisible(devoir.du_le)}`
        : "",
    ].filter(Boolean);

    return carte({
      href: `/eleve/exercice/${x.id}`,
      icone: ICONE[etat],
      titre: x.titre,
      sous: sous.join(" · ") || descriptionEtat(etat),
    });
  };

  const aFaire = exercices.filter((x) => devoirDe.has(String(x.id)));
  const reste = exercices.filter((x) => !devoirDe.has(String(x.id)));
  const corriges = exercices.filter((x) => etatDe(x) === "a-revoir");

  return layoutEcole(
    ecole?.nom ?? "Mes exercices",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Bonjour ${escape(eleve.prenom)}</h1>
<p class="chapeau">
  Vous ouvrez l'exercice que vous voulez, dans l'ordre que vous voulez. Rien
  n'est à débloquer.
</p>

<div class="etat">
  <b>Où vous en êtes</b>
  ${jauge(av)}
</div>

${
  corriges.length > 0
    ? `<div class="etat" data-ton="alerte">
  <b>${corriges.length} exercice${corriges.length > 1 ? "s" : ""} à revoir</b>
  <span>Votre professeur vous a répondu et attend une seconde version.</span>
</div>`
    : ""
}

<h2>À faire pour votre professeur</h2>
${
  aFaire.length === 0
    ? `<p class="vide">Aucun devoir. Piochez ce que vous voulez plus bas.</p>`
    : `<div class="menu">${aFaire.map(ligne).join("")}</div>`
}

<h2>Tous les exercices</h2>
${
  reste.length === 0
    ? `<p class="vide">${
        exercices.length === 0
          ? "Votre professeur n'a pas encore publié d'exercice."
          : "Tous vos exercices sont dans vos devoirs."
      }</p>`
    : `<div class="menu">${reste.map(ligne).join("")}</div>`
}

<p class="aide"><a href="/eleve/mot-de-passe">Changer mon mot de passe</a></p>`,
    { nom: ecole?.nom },
  );
}

function descriptionEtat(etat: EtatTravail): string {
  return {
    "a-faire": "Pas encore ouvert",
    commence: "Commencé, pas encore rendu",
    rendu: "Rendu, en attente de correction",
    acquis: "Corrigé : acquis",
    "a-revoir": "Corrigé : à revoir",
  }[etat];
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
<p class="chapeau">${escape(x.matiere ?? "")}</p>

<div style="margin-bottom:1rem">
  ${etiquette(etat)}
  ${
    devoir?.du_le
      ? `<span class="etiquette" data-retard="${
          enRetard(devoir.du_le, etat) ? "oui" : "non"
        }">${enRetard(devoir.du_le, etat) ? "En retard depuis le " : "À rendre pour le "}${escape(
          dateLisible(devoir.du_le),
        )}</span>`
      : ""
  }
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
  « Garder pour plus tard » enregistre sans prévenir votre professeur. Vous
  pouvez revenir quand vous voulez.
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
    if (!page) return reply.code(404).send();
    return reply.type("text/html").send(page);
  });

  app.get<{ Params: { id: string } }>(
    "/eleve/exercice/:id",
    async (request, reply) => {
      const page = await pageExercice(idDe(request), request.params.id);
      if (!page) return reply.code(404).type("text/html").send(pageExerciceIntrouvable());
      return reply.type("text/html").send(page);
    },
  );

  app.post<{ Params: { id: string }; Body: { reponse?: string; action?: string } }>(
    "/eleve/exercice/:id",
    async (request, reply) => {
      const eleveId = idDe(request);
      const eleve = await eleveParId(eleveId);
      if (!eleve) return reply.code(404).send();

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
        return reply
          .code(400)
          .type("text/html")
          .send(page ?? pageExerciceIntrouvable());
      }

      const fait = await enregistrerTravail(
        { id: eleveId, ecole_id: eleve.ecole_id },
        request.params.id,
        reponse,
        rendre,
      );
      if (!fait) return reply.code(404).type("text/html").send(pageExerciceIntrouvable());

      const page = await pageAccueil(eleveId, {
        ton: "ok",
        texte: rendre
          ? "Rendu. Votre professeur le voit."
          : "Enregistré. Vous pourrez reprendre plus tard.",
      });
      return reply.type("text/html").send(page ?? pageExerciceIntrouvable());
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
      return reply.type("text/html").send(page ?? pageExerciceIntrouvable());
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

function pageExerciceIntrouvable(): string {
  return layoutEcole(
    "Introuvable",
    `<h1>Introuvable</h1>
<p class="chapeau">Cet exercice n'existe pas, ou votre professeur l'a retiré.</p>
<p><a href="/eleve">← Revenir à mes exercices</a></p>`,
  );
}
