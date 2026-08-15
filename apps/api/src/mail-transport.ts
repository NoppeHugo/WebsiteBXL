/**
 * Transport des courriels transactionnels — sans configuration.
 *
 * Ce module ne lit aucune variable d'environnement : il reçoit ses options et
 * rend une fonction d'envoi (README §3.5 bis). C'est ce qui permet à l'API et
 * à l'interface d'administration d'écrire aux clients finaux sans que l'une
 * ait à charger la configuration de l'autre.
 *
 * Jamais de SMTP auto-hébergé : la délivrabilité est mauvaise et la
 * maintenance permanente.
 */

export interface Mail {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export type Send = (mail: Mail) => Promise<void>;

export interface MailerOptions {
  /** `log` écrit dans la console au lieu d'envoyer. Refusé en production. */
  driver: "log" | "resend";
  apiKey?: string;
  from?: string;
}

export function createMailer(options: MailerOptions): Send {
  if (options.driver === "log") {
    return async (mail) => {
      console.log(
        `\n--- courriel (mode log) ---\nÀ : ${mail.to}\nObjet : ${mail.subject}\n\n${mail.text}\n---\n`,
      );
    };
  }

  return async (mail) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: options.from,
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
  };
}
