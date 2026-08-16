import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),

  /**
   * Chemin du clone du dépôt sur le VPS. La console y écrit les `site.json`,
   * commite, pousse, puis déclenche build et déploiement : git reste la source
   * de vérité du contenu (README §3.6).
   */
  REPO_PATH: z.string().min(1),

  /** Change la valeur pour invalider immédiatement toutes les sessions. */
  SESSION_SECRET: z.string().min(32, "au moins 32 caractères"),

  /** Le cookie n'est envoyé qu'en HTTPS hors développement. */
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /** Durée de vie d'une session, en heures. */
  SESSION_HOURS: z.coerce.number().int().positive().default(12),

  /** Injecté dans les builds déclenchés depuis la console. */
  PUBLIC_API_URL: z.string().default(""),
  STRIPE_SECRET_KEY: z.string().optional(),
  PUBLIC_ADMIN_URL: z.string().default(""),

  /**
   * Envoi de courriels. L'interface écrit au client final quand le salon
   * annule un rendez-vous : sans cela, le client se présenterait devant une
   * porte fermée. Mêmes valeurs que pour l'API.
   */
  EMAIL_DRIVER: z.enum(["log", "resend", "smtp"]).default("log"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("no-reply@example.com"),

  /** Relais SMTP — voir `apps/api/src/config.ts` pour le détail. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".")} — ${i.message}`)
    .join("\n");
  throw new Error(`configuration invalide :\n${issues}`);
}

export const config = parsed.data;
export const isProduction = config.NODE_ENV === "production";

if (config.EMAIL_DRIVER === "resend" && !config.RESEND_API_KEY) {
  throw new Error("EMAIL_DRIVER=resend nécessite RESEND_API_KEY");
}
if (config.EMAIL_DRIVER === "smtp" && !(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS)) {
  throw new Error("EMAIL_DRIVER=smtp nécessite SMTP_HOST, SMTP_USER et SMTP_PASS");
}
if (isProduction && config.EMAIL_DRIVER === "log") {
  throw new Error(
    "EMAIL_DRIVER=log en production : un client dont le rendez-vous est annulé ne serait jamais prévenu.",
  );
}
