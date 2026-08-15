import { z } from "zod";

/**
 * Configuration lue au démarrage. Le serveur refuse de démarrer si elle est
 * incomplète : mieux vaut un déploiement qui échoue bruyamment qu'une API
 * silencieusement incapable d'envoyer les demandes de rendez-vous au salon.
 */
const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),

  /**
   * `resend` envoie réellement, `log` écrit dans la sortie standard.
   * `log` sert au développement — jamais en production, d'où le contrôle
   * ci-dessous.
   */
  EMAIL_DRIVER: z.enum(["resend", "log"]).default("log"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Réservations <noreply@example.be>"),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /**
   * Limitation de débit par adresse IP. Elle vise le remplissage automatisé,
   * pas le client : un salon reçoit rarement plus de quelques demandes par
   * heure depuis une même adresse.
   */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW: z.string().default("10 minutes"),

  /**
   * Durées de conservation, en jours. Le RGPD impose de ne pas garder des
   * données personnelles indéfiniment : les lignes plus anciennes sont
   * supprimées automatiquement (voir `db.ts`).
   */
  RETENTION_BOOKING_DAYS: z.coerce.number().int().positive().default(365),
  RETENTION_CONTACT_DAYS: z.coerce.number().int().positive().default(180),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".")} — ${i.message}`)
    .join("\n");
  throw new Error(`configuration invalide :\n${issues}`);
}

export const config = parsed.data;

if (config.NODE_ENV === "production" && config.EMAIL_DRIVER === "log") {
  throw new Error(
    "EMAIL_DRIVER=log en production : les demandes de rendez-vous ne seraient jamais transmises au salon.",
  );
}

if (config.EMAIL_DRIVER === "resend" && !config.RESEND_API_KEY) {
  throw new Error("EMAIL_DRIVER=resend nécessite RESEND_API_KEY");
}
