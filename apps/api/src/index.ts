import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.ts";
import { migrate, purgeExpired, listOrigins, sql } from "./db.ts";
import { bookingRoutes } from "./routes/booking.ts";
import { contactRoutes } from "./routes/contact.ts";
import { collectRoutes } from "./routes/collect.ts";
import { agendaRoutes } from "./routes/agenda.ts";
import { sendMonthlyReports, shouldRunToday } from "./reports.ts";
import { sendReminders } from "./reminders.ts";
import { sendMail } from "./mail.ts";
import { stripeRoutes } from "./routes/stripe.ts";

const app = Fastify({
  logger: { level: config.NODE_ENV === "production" ? "info" : "debug" },
  trustProxy: true,
});

// Les formulaires envoient en `application/x-www-form-urlencoded` quand
// JavaScript est absent : le même point d'entrée doit accepter les deux.
await app.register(formbody);

/*
 * Le corps brut est conservé en plus du JSON analysé : la signature des
 * notifications Stripe porte sur les octets exacts reçus, et re-sérialiser
 * l'objet analysé la rendrait invalide.
 */
declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

app.addContentTypeParser(
  "application/json",
  { parseAs: "buffer" },
  (request, body, done) => {
    request.rawBody = body as Buffer;
    if ((body as Buffer).length === 0) return done(null, {});
    try {
      done(null, JSON.parse((body as Buffer).toString("utf8")));
    } catch (error) {
      done(error as Error);
    }
  },
);

/*
 * `text/plain` porte les balises d'audience.
 *
 * `navigator.sendBeacon` n'échappe au contrôle d'origine que si le type
 * annoncé fait partie de ceux qu'un formulaire pourrait produire ; en
 * `application/json`, le navigateur exige une requête préalable et une
 * autorisation d'identifiants que la balise ne peut pas obtenir — la mesure
 * n'était donc jamais enregistrée dès que l'API vivait sur un autre domaine
 * que le site, c'est-à-dire en production.
 *
 * Le contenu reste du JSON ; seule l'étiquette change. Une charge illisible
 * donne un corps vide, que la validation de la route rejettera d'elle-même.
 *
 * Cela n'élargit pas la surface d'attaque : les formulaires acceptent déjà
 * `application/x-www-form-urlencoded`, tout aussi dispensé de requête
 * préalable. Chaque route valide donc son corps et vérifie le commerce
 * concerné, sans jamais se fier au type annoncé.
 */
app.addContentTypeParser(
  "text/plain",
  { parseAs: "string" },
  (_request, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(null, {});
    }
  },
);

/*
 * Origines autorisées : celles déclarées par les clients en base. Mises en
 * cache une minute pour ne pas interroger la base à chaque requête, tout en
 * prenant en compte un nouveau client sans redémarrage.
 */
let originsCache: { value: Set<string>; at: number } = {
  value: new Set(),
  at: 0,
};

async function allowedOrigins(): Promise<Set<string>> {
  if (Date.now() - originsCache.at < 60_000) return originsCache.value;
  const origins = await listOrigins();
  originsCache = { value: new Set(origins), at: Date.now() };
  return originsCache.value;
}

await app.register(cors, {
  methods: ["GET", "POST"],
  /*
   * Fonction asynchrone à un seul argument : @fastify/cors attend alors une
   * valeur de retour. Utiliser en plus le callback ferait résoudre l'origine
   * deux fois, la seconde avec `undefined`, et toute requête échouerait.
   */
  origin: async (origin: string | undefined) => {
    // Requête sans en-tête Origin : envoi de formulaire classique, pas une
    // requête inter-origines. Rien à bloquer.
    if (!origin) return true;
    const allowed = await allowedOrigins();
    return allowed.has(origin);
  },
});

await app.register(rateLimit, {
  max: config.RATE_LIMIT_MAX,
  timeWindow: config.RATE_LIMIT_WINDOW,
  // Un commerce peut recevoir plusieurs demandes légitimes d'affilée depuis un
  // même réseau ; la limite vise le remplissage automatisé, pas le client.
  keyGenerator: (request) => request.ip,
});

/*
 * Le contrôle de santé échappe à la limitation de débit.
 *
 * Docker l'interroge toutes les trente secondes depuis la même adresse : il
 * épuisait le quota à lui seul et recevait des 429 — deux cent cinquante fois
 * relevées en production. Trois refus consécutifs suffisent à faire déclarer le
 * conteneur malade, donc à le redémarrer, et à couper l'API pendant qu'elle se
 * portait très bien.
 *
 * Le laisser passer n'ouvre rien : la route ne lit qu'une constante depuis la
 * base et n'accepte aucun paramètre.
 */
app.get("/health", { config: { rateLimit: false } }, async () => {
  await sql`select 1`;
  return { ok: true };
});

bookingRoutes(app);
contactRoutes(app);
collectRoutes(app);
agendaRoutes(app);
stripeRoutes(app);

await migrate();

/*
 * Rapports mensuels. Vérifié une fois par jour plutôt que planifié au premier
 * du mois : si le service redémarre ou reste indisponible ce jour-là, l'envoi
 * se rattrape le lendemain au lieu d'être perdu pour le mois.
 */
async function runReports(): Promise<void> {
  if (!shouldRunToday()) return;
  const result = await sendMonthlyReports(sql, sendMail);
  if (result.sent.length || result.failed.length) {
    app.log.info(result, "rapports mensuels");
  }
}

const reportTimer = setInterval(() => {
  runReports().catch((error) =>
    app.log.error({ err: error }, "envoi des rapports impossible"),
  );
}, 6 * 60 * 60 * 1000);
reportTimer.unref();
void runReports().catch(() => {});

/*
 * Rappels de rendez-vous, vérifiés chaque heure. La fenêtre d'envoi couvre
 * dix-huit heures, donc une interruption du service ne fait rien manquer.
 */
const reminderTimer = setInterval(() => {
  sendReminders(sql, sendMail)
    .then((result) => {
      if (result.sent.length || result.failed.length) {
        app.log.info(result, "rappels de rendez-vous");
      }
    })
    .catch((error) => app.log.error({ err: error }, "rappels impossibles"));
}, 60 * 60 * 1000);
reminderTimer.unref();

// Purge quotidienne des données expirées (obligation de conservation limitée).
const purgeTimer = setInterval(
  () => {
    purgeExpired()
      .then(({ bookings, messages, events }) => {
        if (bookings || messages || events) {
          app.log.info({ bookings, messages, events }, "données expirées supprimées");
        }
      })
      .catch((error) => app.log.error({ err: error }, "purge impossible"));
  },
  24 * 60 * 60 * 1000,
);
purgeTimer.unref();

await app.listen({ port: config.PORT, host: config.HOST });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    app.log.info("arrêt demandé");
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}
