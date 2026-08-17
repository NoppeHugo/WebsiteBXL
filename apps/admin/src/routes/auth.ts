import type { FastifyInstance } from "fastify";
import { config, isProduction } from "../config.ts";
import { findAdminByEmail, touchLogin } from "../db.ts";
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
</form>`,
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

      const user = await findAdminByEmail(email);

      /*
       * Même message et même chemin de code quel que soit l'échec : identifiant
       * inconnu, mot de passe faux ou code invalide sont indiscernables, sinon
       * la page devient un outil pour découvrir les comptes existants.
       */
      const passwordOk = user
        ? await verifyPassword(password, user.password_hash)
        : false;

      const totpOk = user?.totp_secret
        ? verifyTotp(user.totp_secret, code)
        : true;

      if (!user || !passwordOk || !totpOk) {
        request.log.warn({ email, ip: request.ip }, "connexion refusée");
        return reply
          .code(401)
          .type("text/html")
          .send(loginPage("Identifiants refusés.", email));
      }

      await touchLogin(user.id);

      const token = signSession(
        {
          userId: Number(user.id),
          expiresAt: Date.now() + config.SESSION_HOURS * 3600_000,
        },
        config.SESSION_SECRET,
      );

      /*
       * Chacun chez soi. Le commerçant tombe sur son espace, l'exploitant sur
       * sa console. Le crochet global le ferait de toute façon, mais une
       * redirection de plus au premier écran donne l'impression d'un outil qui
       * hésite.
       */
      return reply
        .setCookie(COOKIE, token, {
          httpOnly: true,
          sameSite: "strict",
          secure: isProduction,
          path: "/",
          maxAge: config.SESSION_HOURS * 3600,
        })
        .redirect(user.tenant_slug ? "/espace" : "/", 303);
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
