import type { FastifyInstance, FastifyReply } from "fastify";
import { config, isProduction } from "../config.ts";
import { hashPassword, signSession } from "../auth.ts";
import { creerEcole } from "../db-ecole.ts";
import { emailValide } from "../ecole.ts";
import { layoutEcole } from "../views-ecole.ts";
import { message } from "../views-client.ts";
import { escape } from "../views.ts";
import { SESSION_COOKIE } from "./auth.ts";

/**
 * Ouvrir une école, soi-même, sans passer par l'exploitant.
 *
 * ─── Pourquoi une inscription libre, dans une console qui n'en a jamais eu ──
 *
 * Les comptes commerçants sont ouverts à la main, et ce sera toujours le cas :
 * ils donnent accès à un site qu'on a vendu, installé et facturé. Un compte
 * d'école ne donne accès à rien de tout cela. Il ne voit aucun site, aucun
 * client, aucune facture — seulement ses propres élèves et ses propres
 * exercices, créés depuis zéro par celui qui s'inscrit.
 *
 * D'où l'inscription libre : une auto-école qu'on démarche le mardi peut
 * essayer l'espace de cours le soir même, et c'est elle qui apporte la
 * démonstration lors du rendez-vous suivant. Faire dépendre cet essai d'un
 * courriel à l'exploitant, c'est le remettre à la semaine d'après, c'est-à-dire
 * à jamais.
 *
 * ─── Ce que cette porte ne peut pas ouvrir ────────────────────────────────
 *
 * Le compte créé ici porte `ecole_id` et rien d'autre. `acces.ts` en fait un
 * « responsable », et le crochet d'authentification ne le laisse sortir de
 * `/cours` sous aucun prétexte. La base interdit par contrainte qu'il porte en
 * plus un commerce. Il n'existe aucun chemin, depuis ce formulaire, vers un
 * site client.
 */

const MOT_DE_PASSE_MINIMUM = 12;

function pageInscription(erreur?: string, saisie: { nom?: string; email?: string } = {}): string {
  return layoutEcole(
    "Ouvrir un espace de cours",
    `<div class="connexion">
<h1>Votre espace de cours</h1>
<p class="chapeau">
  Vous invitez vos élèves, vous publiez vos exercices, vous voyez où chacun en
  est. C'est tout, et c'est gratuit le temps d'essayer.
</p>

${erreur ? message("ko", erreur) : ""}

<form method="post" action="/inscription">
  <label>Le nom de votre école
    <input type="text" name="nom" required maxlength="120" autocomplete="organization"
           value="${escape(saisie.nom ?? "")}" placeholder="Auto-école du Parvis">
  </label>
  <label>Votre adresse e-mail
    <input type="email" name="email" required autocomplete="username"
           value="${escape(saisie.email ?? "")}">
  </label>
  <label>Votre mot de passe
    <input type="password" name="motdepasse" required minlength="${MOT_DE_PASSE_MINIMUM}"
           autocomplete="new-password">
  </label>
  <label>Le même, pour être sûr
    <input type="password" name="confirmation" required minlength="${MOT_DE_PASSE_MINIMUM}"
           autocomplete="new-password">
  </label>
  <div class="actions"><button type="submit">Ouvrir mon espace</button></div>
</form>

<p class="aide" style="text-align:center">
  Vous avez déjà un compte ? <a href="/login">Se connecter</a>
</p>
</div>`,
  );
}

export function inscriptionRoutes(app: FastifyInstance): void {
  app.get("/inscription", async (_request, reply) =>
    reply.type("text/html").send(pageInscription()),
  );

  app.post<{
    Body: { nom?: string; email?: string; motdepasse?: string; confirmation?: string };
  }>(
    "/inscription",
    {
      /*
       * Une porte ouverte se referme à coups de comptes fantômes : sans
       * limite, un script en crée mille en une minute, et la liste de
       * l'exploitant devient illisible le jour où il en a besoin. Cinq par
       * heure et par adresse suffisent largement à quelqu'un qui s'inscrit.
       */
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const nom = (request.body?.nom ?? "").trim();
      const email = (request.body?.email ?? "").trim().toLowerCase();
      const motdepasse = request.body?.motdepasse ?? "";
      const confirmation = request.body?.confirmation ?? "";

      const refus = (texte: string): FastifyReply =>
        reply.code(400).type("text/html").send(pageInscription(texte, { nom, email }));

      if (nom === "") return refus("Donnez un nom à votre école.");
      if (nom.length > 120) return refus("Ce nom est trop long : 120 caractères au plus.");
      if (!emailValide(email)) return refus("Cette adresse e-mail ne semble pas valide.");
      if (motdepasse.length < MOT_DE_PASSE_MINIMUM) {
        return refus(`Le mot de passe doit faire au moins ${MOT_DE_PASSE_MINIMUM} caractères.`);
      }
      if (motdepasse !== confirmation) {
        return refus("Les deux mots de passe ne sont pas identiques.");
      }

      const ouverture = await creerEcole(nom, email, await hashPassword(motdepasse));
      if (!ouverture.ok) {
        // 409 et non 400 : l'adresse est valide, elle est simplement prise.
        return reply
          .code(409)
          .type("text/html")
          .send(pageInscription(ouverture.raison, { nom, email }));
      }

      request.log.info({ ecoleId: ouverture.ecoleId, email }, "école ouverte");

      /*
       * Connecté dans la foulée. Renvoyer vers la page de connexion après avoir
       * fait saisir un mot de passe deux fois, c'est le faire ressaisir une
       * troisième — et perdre en route ceux qui essayaient justement de voir à
       * quoi ça ressemble.
       */
      const token = signSession(
        {
          userId: Number(ouverture.adminId),
          expiresAt: Date.now() + config.SESSION_HOURS * 3600_000,
          qui: "admin",
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
        .redirect("/cours", 303);
    },
  );
}
