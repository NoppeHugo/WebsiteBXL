import Fastify from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { config, isProduction } from "./config.ts";
import { readSession } from "./auth.ts";
import { sql } from "./db.ts";
import { authRoutes, SESSION_COOKIE } from "./routes/auth.ts";
import { clientRoutes } from "./routes/clients.ts";
import { nouveauRoutes } from "./routes/nouveau.ts";
import { contenuRoutes } from "./routes/contenu.ts";
import { apparenceRoutes } from "./routes/apparence.ts";
import { requestRoutes } from "./routes/requests.ts";
import { reportRoutes } from "./routes/reports.ts";
import { billingRoutes } from "./routes/billing.ts";
import { agendaRoutes } from "./routes/agenda.ts";

const app = Fastify({
  logger: { level: isProduction ? "info" : "debug" },
  trustProxy: true,
  // Le JSON complet d'un client, envoyé par l'éditeur avancé, dépasse la
  // limite par défaut d'un formulaire.
  bodyLimit: 2 * 1024 * 1024,
});

await app.register(formbody, { bodyLimit: 2 * 1024 * 1024 });
await app.register(cookie);
// Envoi de photos : plusieurs fichiers par requête, taille bornée dans la route.
await app.register(multipart);
await app.register(rateLimit, { global: false });

/*
 * Aucune page n'est publique en dehors de la connexion. Le contrôle est un
 * crochet global plutôt qu'une décoration par route : oublier de protéger une
 * route deviendrait alors impossible, et c'est exactement le genre d'oubli qui
 * exposerait les sites de tous les clients.
 */
const PUBLIC_PATHS = new Set(["/login", "/logout", "/health"]);

app.addHook("onRequest", async (request, reply) => {
  if (PUBLIC_PATHS.has(request.url.split("?")[0]!)) return;

  const session = readSession(request.cookies[SESSION_COOKIE], config.SESSION_SECRET);
  if (!session) {
    return reply.redirect("/login", 303);
  }
  (request as typeof request & { adminId: number }).adminId = session.userId;
});

// En-têtes de sécurité : la console n'affiche que ses propres pages, sans
// ressource externe ni intégration dans un cadre tiers.
app.addHook("onSend", async (_request, reply) => {
  reply.headers({
    /*
     * `script-src 'self'` autorise le seul script de la console, servi par
     * `/assets/editeur.js`. Volontairement sans `unsafe-inline` : les
     * gestionnaires écrits dans le balisage restent interdits, y compris ceux
     * que produirait un contenu de client mal échappé.
     *
     * `img-src` couvre les aperçus de photos, `connect-src` l'envoi des images
     * par l'éditeur.
     */
    "content-security-policy":
      "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; " +
      "img-src 'self' data:; connect-src 'self'; form-action 'self'; " +
      "frame-ancestors 'none'; base-uri 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
});

app.get("/health", async () => {
  await sql`select 1`;
  return { ok: true };
});

authRoutes(app);
/*
 * Avant `clientRoutes` : `/clients/nouveau` et `/clients/:slug` se
 * ressemblent. Le routeur de Fastify donne bien la priorité au chemin fixe,
 * quel que soit l'ordre — mais l'ordre de lecture, lui, dit l'intention.
 */
nouveauRoutes(app);
clientRoutes(app);
contenuRoutes(app);
apparenceRoutes(app);
requestRoutes(app);
reportRoutes(app);
billingRoutes(app);
agendaRoutes(app);

await app.listen({ port: config.PORT, host: config.HOST });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}
