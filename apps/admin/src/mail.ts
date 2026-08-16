import { createMailer } from "@bxl/api/mail-transport";
import { config } from "./config.ts";

/**
 * L'envoi de l'interface d'administration, lié à sa propre configuration.
 *
 * Le transport est partagé avec l'API ; la configuration ne l'est pas. Importer
 * `@bxl/api/mail` chargerait la configuration de l'API dans un processus qui ne
 * la possède pas, et le démarrage échouerait (README §3.5 bis).
 */
export const sendMail = createMailer({
  driver: config.EMAIL_DRIVER,
  apiKey: config.RESEND_API_KEY,
  from: config.MAIL_FROM,
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
