import { config } from "./config.ts";

export interface Mail {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}

/**
 * Envoi transactionnel.
 *
 * Jamais de SMTP auto-hébergé : la délivrabilité est mauvaise et la
 * maintenance permanente. En développement, `log` écrit dans la console au
 * lieu d'envoyer — la configuration refuse ce mode en production.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (config.EMAIL_DRIVER === "log") {
    console.log(
      `\n--- courriel (mode log) ---\nÀ : ${mail.to}\nObjet : ${mail.subject}\n\n${mail.text}\n---\n`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.MAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      ...(mail.replyTo && { reply_to: mail.replyTo }),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `envoi refusé par Resend (${response.status}) : ${await response.text()}`,
    );
  }
}
