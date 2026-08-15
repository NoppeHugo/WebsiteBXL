import type { Mail } from "./mail-transport.ts";

/**
 * Courriels adressés au client final à propos de son rendez-vous, autres que
 * la confirmation et le rappel.
 *
 * Module sans configuration ni base : il reçoit les faits et rend un courriel
 * (README §3.5 bis). C'est ce qui permet à l'interface d'administration de
 * l'utiliser sans charger la configuration de l'API.
 */

export interface Cancellation {
  customerName: string;
  customerEmail: string;
  businessName: string;
  businessPhone: string;
  serviceName: string;
  /** Déjà formatée dans la langue et le fuseau du client. */
  when: string;
  locale: string;
}

const SUBJECT: Record<string, (business: string) => string> = {
  fr: (b) => `Votre rendez-vous chez ${b} a été annulé`,
  nl: (b) => `Uw afspraak bij ${b} is geannuleerd`,
  en: (b) => `Your appointment at ${b} has been cancelled`,
};

const BODY: Record<
  string,
  (n: string, b: string, s: string, w: string, tel: string) => string
> = {
  fr: (n, b, s, w, tel) =>
    `Bonjour ${n},\n\n${b} a dû annuler votre rendez-vous du ${w} (${s}).\n\nNous en sommes désolés. Pour convenir d'un autre moment, appelez le ${tel} — ou reprenez rendez-vous en ligne, les créneaux sont à jour.\n\nÀ bientôt.`,
  nl: (n, b, s, w, tel) =>
    `Beste ${n},\n\n${b} heeft uw afspraak van ${w} (${s}) moeten annuleren.\n\nOnze excuses. Bel ${tel} om een ander moment af te spreken — of boek online, de tijdstippen zijn bijgewerkt.\n\nTot binnenkort.`,
  en: (n, b, s, w, tel) =>
    `Hello ${n},\n\n${b} had to cancel your appointment on ${w} (${s}).\n\nWe are sorry about this. Call ${tel} to arrange another time — or book online, the slots are up to date.\n\nSee you soon.`,
};

/**
 * Annonce au client que le salon a annulé son rendez-vous.
 *
 * Sans ce courriel, une annulation prise au téléphone ou depuis l'agenda
 * laisse le client se présenter devant une porte fermée. C'est pire qu'une
 * absence : c'est le commerce qui paraît peu sérieux, sur l'outil qu'on lui a
 * vendu.
 */
export function cancelledByBusiness(details: Cancellation): Mail {
  const subject = SUBJECT[details.locale] ?? SUBJECT.fr!;
  const body = BODY[details.locale] ?? BODY.fr!;

  return {
    to: details.customerEmail,
    subject: subject(details.businessName),
    text: body(
      details.customerName,
      details.businessName,
      details.serviceName,
      details.when,
      details.businessPhone,
    ),
  };
}
