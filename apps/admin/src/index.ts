import Fastify from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { config, isProduction } from "./config.ts";
import { readSession } from "./auth.ts";
import { sql, findAdminById } from "./db.ts";
import { utilisateurDe } from "./acces.ts";
import { authRoutes, SESSION_COOKIE } from "./routes/auth.ts";
import { clientRoutes } from "./routes/clients.ts";
import { nouveauRoutes } from "./routes/nouveau.ts";
import { contenuRoutes } from "./routes/contenu.ts";
import { apparenceRoutes } from "./routes/apparence.ts";
import { requestRoutes } from "./routes/requests.ts";
import { reportRoutes } from "./routes/reports.ts";
import { billingRoutes } from "./routes/billing.ts";
import { agendaRoutes } from "./routes/agenda.ts";
import { espaceRoutes } from "./routes/espace.ts";
import { comptesRoutes } from "./routes/comptes.ts";

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
const PUBLIC_PATHS = new Set([
  "/login",
  "/logout",
  "/deconnexion",
  "/health",
  "/assets/editeur.js",
  "/assets/espace.js",
]);

/**
 * Authentification, puis séparation des deux mondes.
 *
 * Trois barrières, et chacune suffirait seule. C'est délibéré : ce crochet est
 * le seul endroit qui empêche un commerçant d'ouvrir le site d'un autre, et
 * une seule ligne de défense sur une question pareille se franchit le jour où
 * quelqu'un la modifie sans en comprendre le rôle.
 *
 *  1. Le rôle. Un commerçant n'atteint que `/espace`, l'exploitant n'y va pas.
 *  2. Le nom d'hôte. Le portail répond sur son propre domaine et n'y sert que
 *     l'espace client ; la console de l'exploitant, sur le sien.
 *  3. Le site. Aucune route de l'espace ne prend d'identifiant de commerce :
 *     il vient de la session (voir `acces.ts`). Il n'y a rien à falsifier.
 */
app.addHook("onRequest", async (request, reply) => {
  const chemin = request.url.split("?")[0]!;
  // `hostname` vient de l'en-tête Host, réécrit par nginx. Comparé en
  // minuscules et sans port : « MON.example.be:443 » désigne le même hôte.
  const surLePortail =
    config.PORTAL_HOST !== "" &&
    request.hostname.toLowerCase().split(":")[0] === config.PORTAL_HOST.toLowerCase();

  if (PUBLIC_PATHS.has(chemin)) return;

  const session = readSession(request.cookies[SESSION_COOKIE], config.SESSION_SECRET);
  if (!session) {
    return reply.redirect("/login", 303);
  }

  // Relu en base à chaque requête : un accès retiré doit cesser tout de suite,
  // pas à l'expiration du jeton (voir `findAdminById`).
  const compte = await findAdminById(session.userId);
  if (!compte) {
    return reply.clearCookie(SESSION_COOKIE, { path: "/" }).redirect("/login", 303);
  }

  const u = utilisateurDe(compte);
  (request as typeof request & { adminId: number }).adminId = u.id;
  (request as typeof request & { utilisateur: typeof u }).utilisateur = u;

  const dansLEspace = chemin === "/espace" || chemin.startsWith("/espace/");

  if (u.slug !== null) {
    /*
     * Commerçant. Il est ramené sur le portail s'il arrive par l'adresse de la
     * console — un lien gardé en signet, une adresse dictée de travers — puis
     * sur son accueil s'il demande autre chose que son espace. Des
     * redirections plutôt que des refus : il n'a rien fait de mal.
     */
    if (config.PORTAL_HOST && !surLePortail) {
      return reply.redirect(`https://${config.PORTAL_HOST}/espace`, 303);
    }
    if (!dansLEspace) return reply.redirect("/espace", 303);

    /*
     * Tant que le mot de passe remis n'a pas été remplacé, une seule page est
     * accessible. Un mot de passe dicté au comptoir a été entendu par au moins
     * deux personnes ; le laisser en place revient à ne pas en avoir.
     */
    if (u.motDePasseAChanger && chemin !== "/espace/mot-de-passe") {
      return reply.redirect("/espace/mot-de-passe", 303);
    }
    return;
  }

  /*
   * Exploitant. Le portail ne lui sert à rien — il n'a pas de commerce attaché
   * — et surtout, il ne doit pas y devenir une porte d'entrée : un domaine, un
   * usage. Un refus franc, pas une redirection, pour que l'adresse du portail
   * ne mène jamais à la console.
   */
  if (surLePortail) {
    return reply.code(404).type("text/html").send(
      "<!doctype html><meta charset=utf-8><title>Introuvable</title>" +
        "<p style='font:16px system-ui;padding:2rem'>Cette adresse est réservée aux commerçants.",
    );
  }

  if (dansLEspace) return reply.redirect("/clients", 303);
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
comptesRoutes(app);
espaceRoutes(app);

await app.listen({ port: config.PORT, host: config.HOST });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}
