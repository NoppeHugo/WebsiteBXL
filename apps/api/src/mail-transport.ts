/**
 * Transport des courriels transactionnels — sans configuration.
 *
 * Ce module ne lit aucune variable d'environnement : il reçoit ses options et
 * rend une fonction d'envoi (README §3.5 bis). C'est ce qui permet à l'API et
 * à l'interface d'administration d'écrire aux clients finaux sans que l'une
 * ait à charger la configuration de l'autre.
 *
 * Jamais de SMTP auto-hébergé : la délivrabilité est mauvaise et la
 * maintenance permanente. Le driver `smtp` sert à passer par le relais d'un
 * tiers qui, lui, entretient sa réputation d'expéditeur — Gmail, Fastmail,
 * l'hébergeur du domaine. Ce n'est pas la même chose que de tenir soi-même un
 * serveur de courrier.
 */

// Type seul : effacé à la compilation, il n'entraîne aucun chargement de
// nodemailer à l'exécution — c'est l'import dynamique plus bas qui décide.
import type { Transporter } from "nodemailer";

export interface Mail {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export type Send = (mail: Mail) => Promise<void>;

export interface SmtpOptions {
  host: string;
  port: number;
  /** `true` pour TLS d'emblée (port 465), `false` pour STARTTLS (587). */
  secure: boolean;
  user: string;
  pass: string;
}

export interface MailerOptions {
  /** `log` écrit dans la console au lieu d'envoyer. Refusé en production. */
  driver: "log" | "resend" | "smtp";
  apiKey?: string;
  from?: string;
  smtp?: SmtpOptions;
}

export function createMailer(options: MailerOptions): Send {
  if (options.driver === "log") {
    return async (mail) => {
      console.log(
        `\n--- courriel (mode log) ---\nÀ : ${mail.to}\nObjet : ${mail.subject}\n\n${mail.text}\n---\n`,
      );
    };
  }

  if (options.driver === "smtp") {
    const smtp = options.smtp;
    if (!smtp) {
      throw new Error("driver « smtp » sans paramètres de connexion");
    }

    /*
     * Le transporteur est construit à la première utilisation, puis conservé :
     * nodemailer maintient un pool de connexions, et en refaire un à chaque
     * courriel rouvrirait une session TLS complète à chaque fois.
     *
     * L'import est dynamique pour que nodemailer ne soit chargé que par les
     * déploiements qui s'en servent — un service en `resend` ou en `log` ne
     * paie ni le temps de chargement ni la mémoire.
     */
    let transporteur: Promise<Transporter> | undefined;
    const connexion = () =>
      (transporteur ??= import("nodemailer").then((m) =>
        m.default.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: { user: smtp.user, pass: smtp.pass },
        }),
      ));

    return async (mail) => {
      const t = await connexion();
      await t.sendMail({
        from: options.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        ...(mail.replyTo && { replyTo: mail.replyTo }),
      });
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
