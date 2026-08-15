import type { Sql } from "postgres";
import type { Mail } from "./mail.ts";

/**
 * Rappel de rendez-vous, par courriel.
 *
 * Les absences sont le coût invisible d'un agenda en ligne : un créneau
 * inoccupé ne se revend pas. Un rappel la veille les réduit nettement, et
 * chaque rappel porte le lien d'annulation — un client qui annule libère le
 * créneau, ce qui vaut infiniment mieux qu'un client qui ne vient pas.
 *
 * Par courriel uniquement : le SMS a un coût par envoi et n'a pas été retenu.
 */

interface DueRow {
  id: string;
  business_name: string;
  origin: string;
  service_name: string;
  starts_at: string;
  customer_name: string;
  customer_email: string;
  locale: string;
  cancel_token: string;
}

const BODY: Record<
  string,
  (name: string, business: string, service: string, when: string, url: string) => string
> = {
  fr: (n, b, s, w, u) =>
    `Bonjour ${n},\n\nPetit rappel : votre rendez-vous chez ${b} a lieu ${w}.\n${s}\n\nUn empêchement ? Annulez ici, le créneau repartira à quelqu'un d'autre :\n${u}\n\nÀ demain.`,
  nl: (n, b, s, w, u) =>
    `Beste ${n},\n\nKleine herinnering: uw afspraak bij ${b} is ${w}.\n${s}\n\nVerhinderd? Annuleer hier, dan komt het tijdstip weer vrij:\n${u}\n\nTot morgen.`,
  en: (n, b, s, w, u) =>
    `Hello ${n},\n\nA quick reminder: your appointment at ${b} is ${w}.\n${s}\n\nCan't make it? Cancel here and the slot goes back to someone else:\n${u}\n\nSee you tomorrow.`,
};

const SUBJECT: Record<string, (business: string) => string> = {
  fr: (b) => `Rappel — votre rendez-vous chez ${b} demain`,
  nl: (b) => `Herinnering — uw afspraak bij ${b} morgen`,
  en: (b) => `Reminder — your appointment at ${b} tomorrow`,
};

export function cancelUrl(origin: string, token: string, locale: string): string {
  const prefix = locale === "fr" ? "" : `${locale}/`;
  return `${origin.replace(/\/+$/, "")}/${prefix}annulation/?t=${token}`;
}

export function formatWhen(starts: Date, locale: string): string {
  return new Intl.DateTimeFormat(`${locale}-BE`, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  }).format(starts);
}

/**
 * Envoie les rappels dus.
 *
 * Fenêtre : entre 18 et 36 heures avant le rendez-vous. Assez large pour
 * qu'un service arrêté quelques heures ne fasse rien manquer, assez étroite
 * pour ne pas prévenir trois jours à l'avance — un rappel trop tôt est un
 * rappel oublié. `reminder_sent_at` garantit l'unicité de l'envoi.
 */
export async function sendReminders(
  sql: Sql,
  send: (mail: Mail) => Promise<void>,
  now = new Date(),
): Promise<{ sent: string[]; failed: string[] }> {
  const due = await sql<DueRow[]>`
    select a.id, t.business_name, t.origin, a.service_name,
           lower(a.during) as starts_at, a.customer_name, a.customer_email,
           a.locale, a.cancel_token
    from appointments a
    join tenants t on t.id = a.tenant_id
    where a.status = 'booked'
      and a.reminder_sent_at is null
      and lower(a.during) between ${now}::timestamptz + interval '18 hours'
                              and ${now}::timestamptz + interval '36 hours'
    order by lower(a.during)
  `;

  const sent: string[] = [];
  const failed: string[] = [];

  for (const row of due) {
    const when = formatWhen(new Date(row.starts_at), row.locale);
    const url = cancelUrl(row.origin, row.cancel_token, row.locale);

    try {
      await send({
        to: row.customer_email,
        subject: (SUBJECT[row.locale] ?? SUBJECT.fr!)(row.business_name),
        text: (BODY[row.locale] ?? BODY.fr!)(
          row.customer_name,
          row.business_name,
          row.service_name,
          when,
          url,
        ),
      });

      await sql`
        update appointments set reminder_sent_at = now() where id = ${row.id}
      `;
      sent.push(row.id);
    } catch {
      // La marque n'est pas posée : la prochaine passe réessaiera, tant que
      // le rendez-vous reste dans la fenêtre.
      failed.push(row.id);
    }
  }

  return { sent, failed };
}
