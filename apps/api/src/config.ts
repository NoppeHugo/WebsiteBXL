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
   * `resend` et `smtp` envoient réellement, `log` écrit dans la sortie
   * standard. `log` sert au développement — jamais en production, d'où le
   * contrôle ci-dessous.
   */
  EMAIL_DRIVER: z.enum(["resend", "smtp", "log"]).default("log"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Réservations <noreply@example.be>"),

  /**
   * Relais SMTP, quand `EMAIL_DRIVER=smtp`. Pour Gmail :
   * `smtp.gmail.com`, port 465, et un **mot de passe d'application** —
   * le mot de passe du compte est refusé, et la validation en deux étapes
   * doit être active pour pouvoir en créer un.
   *
   * Le chiffrement se déduit du port : 465 ouvre une session TLS d'emblée,
   * les autres (587 en tête) montent en TLS par STARTTLS. Une variable de
   * plus serait une occasion de plus de se tromper.
   */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /**
   * Stripe. Absent, les abonnements sont simplement désactivés : le service
   * doit pouvoir tourner avant qu'un compte de facturation existe.
   */
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

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
  /** L'audience n'a d'intérêt que sur l'année écoulée, pour comparer. */
  RETENTION_ANALYTICS_DAYS: z.coerce.number().int().positive().default(400),
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

if (config.EMAIL_DRIVER === "smtp") {
  const manquants = (
    [
      ["SMTP_HOST", config.SMTP_HOST],
      ["SMTP_USER", config.SMTP_USER],
      ["SMTP_PASS", config.SMTP_PASS],
    ] as const
  )
    .filter(([, valeur]) => !valeur)
    .map(([nom]) => nom);

  if (manquants.length > 0) {
    throw new Error(`EMAIL_DRIVER=smtp nécessite ${manquants.join(", ")}`);
  }
}
