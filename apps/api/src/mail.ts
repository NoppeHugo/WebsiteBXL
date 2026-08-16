import { config } from "./config.ts";
import { createMailer } from "./mail-transport.ts";

export type { Mail, Send } from "./mail-transport.ts";

/**
 * L'envoi de l'API, lié à sa configuration. Le transport lui-même vit dans
 * `mail-transport.ts`, qui n'en dépend pas : c'est ce fichier-ci, et lui seul,
 * qui connaît l'environnement.
 */
export const sendMail = createMailer({
  driver: config.EMAIL_DRIVER,
  apiKey: config.RESEND_API_KEY,
  from: config.MAIL_FROM,
  // La configuration garantit déjà que ces trois valeurs sont présentes quand
  // le driver est `smtp` ; ailleurs, l'objet n'est jamais lu.
  smtp: config.SMTP_HOST
    ? {
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        user: config.SMTP_USER ?? "",
        pass: config.SMTP_PASS ?? "",
      }
    : undefined,
});
