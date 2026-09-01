import type { FastifyInstance } from "fastify";
import { config, isProduction } from "../config.ts";
import { findAdminByEmail, touchLogin } from "../db.ts";
import { eleveParEmail, touchLoginEleve } from "../db-ecole.ts";
import { verifyPassword, verifyTotp, signSession } from "../auth.ts";
import { layout, flash, escape } from "../views.ts";

const COOKIE = "bxl_session";

function loginPage(error?: string, email = ""): string {
  return layout(
    "Connexion",
    `<h1>Console</h1>
${error ? flash("error", error) : ""}
<form method="post" action="/login">
  <label>Adresse e-mail
    <input type="email" name="email" required autocomplete="username" value="${escape(email)}">
  </label>
  <label>Mot de passe
    <input type="password" name="password" required autocomplete="current-password">
  </label>
  <label>Code à six chiffres
    <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code"
           pattern="[0-9]{6}" placeholder="123456">
  </label>
  <div class="actions"><button type="submit">Se connecter</button></div>
</form>
<p style="margin-top:1.6rem;font-size:0.92rem">
  Vous dirigez une école, un cours, une formation ?
  <a href="/inscription">Ouvrez votre espace de cours</a>.
</p>`,
  );
}

export function authRoutes(app: FastifyInstance): void {
  app.get("/login", async (_request, reply) =>
    reply.type("text/html").send(loginPage()),
  );

  app.post<{ Body: { email?: string; password?: string; code?: string } }>(
    "/login",
    {
      config: {
        // Limite stricte : c'est le seul point d'entrée d'un outil qui peut
        // mettre hors ligne tous les sites clients.
        rateLimit: { max: 8, timeWindow: "15 minutes" },
      },
    },
    async (request, reply) => {
      const { email = "", password = "", code = "" } = request.body ?? {};

      /*
       * Deux tables, un seul formulaire.
       *
       * Les élèves ont la leur (migration 011), mais rien ne le laisse voir
       * ici : personne ne devrait avoir à savoir dans quelle table il est rangé
       * pour se connecter. La table des comptes de console d'abord, celle des
       * élèves ensuite — les adresses ne peuvent pas être dans les deux, la
       * création l'interdit des deux côtés.
       */
      const user = await findAdminByEmail(email);
      const eleve = user ? undefined : await eleveParEmail(email);

      /*
       * Même message et même chemin de code quel que soit l'échec : identifiant
       * inconnu, mot de passe faux ou code invalide sont indiscernables, sinon
       * la page devient un outil pour découvrir les comptes existants. Un élève
       * invité mais qui n'a pas encore choisi son mot de passe n'en a pas : il
       * tombe dans le même cas que l'inconnu, et son invitation reste la seule
       * porte.
       */
      const identifiants = user
        ? { hash: user.password_hash, totp: user.totp_secret }
        : eleve?.password_hash
          ? { hash: eleve.password_hash, totp: null }
          : undefined;

      const passwordOk = identifiants
        ? await verifyPassword(password, identifiants.hash)
        : false;

      const totpOk = identifiants?.totp ? verifyTotp(identifiants.totp, code) : true;

      if (!identifiants || !passwordOk || !totpOk) {
        request.log.warn({ email, ip: request.ip }, "connexion refusée");
        return reply
          .code(401)
          .type("text/html")
          .send(loginPage("Identifiants refusés.", email));
      }

      /*
       * Chacun chez soi. Le commerçant tombe sur son espace, le responsable sur
       * ses élèves, l'élève sur ses exercices, l'exploitant sur sa console. Le
       * crochet global le ferait de toute façon, mais une redirection de plus au
       * premier écran donne l'impression d'un outil qui hésite.
       */
      const arrivee = user
        ? user.ecole_id
          ? "/cours"
          : user.tenant_slug
            ? "/espace"
            : "/"
        : "/eleve";

      if (user) await touchLogin(user.id);
      else await touchLoginEleve(eleve!.id);

      const token = signSession(
        {
          userId: Number(user ? user.id : eleve!.id),
          expiresAt: Date.now() + config.SESSION_HOURS * 3600_000,
          qui: user ? "admin" : "eleve",
        },
        config.SESSION_SECRET,
      );

      return reply
        .setCookie(COOKIE, token, {
          httpOnly: true,
          sameSite: "strict",
          secure: isProduction,
          path: "/",
          maxAge: config.SESSION_HOURS * 3600,
        })
        .redirect(arrivee, 303);
    },
  );

  app.post("/logout", async (_request, reply) =>
    reply.clearCookie(COOKIE, { path: "/" }).redirect("/login", 303),
  );

  /*
   * L'espace commerçant se déconnecte par un lien, pas par un formulaire : il
   * n'y a rien à protéger — au pire, quelqu'un le déconnecte, et il se
   * reconnecte. Un bouton de formulaire au milieu d'une barre de navigation
   * aurait demandé du balisage pour rien.
   */
  app.get("/deconnexion", async (_request, reply) =>
    reply.clearCookie(COOKIE, { path: "/" }).redirect("/login", 303),
  );
}

export const SESSION_COOKIE = COOKIE;
