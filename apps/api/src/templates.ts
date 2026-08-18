import type { Language } from "@bxl/schema";
import type { PreferredPeriod } from "@bxl/schema/booking";

const PERIOD: Record<Language, Record<PreferredPeriod, string>> = {
  fr: { morning: "le matin", afternoon: "l'après-midi", evening: "en soirée" },
  nl: { morning: "'s ochtends", afternoon: "'s namiddags", evening: "'s avonds" },
  en: { morning: "morning", afternoon: "afternoon", evening: "evening" },
};

export function periodLabel(
  period: PreferredPeriod,
  lang: Language = "fr",
): string {
  return PERIOD[lang][period];
}

export interface BookingMailData {
  businessName: string;
  serviceName: string;
  preferredDate: string;
  preferredPeriod: PreferredPeriod;
  name: string;
  email: string;
  phone?: string;
  note?: string;
  locale: Language;
}

/** Courriel envoyé au salon : tout ce qu'il faut pour rappeler et confirmer. */
export function bookingToBusiness(data: BookingMailData): {
  subject: string;
  text: string;
} {
  const when = `${data.preferredDate} — ${periodLabel(data.preferredPeriod, "fr")}`;
  return {
    subject: `Demande de rendez-vous — ${data.name} (${data.preferredDate})`,
    text: [
      `Nouvelle demande de rendez-vous pour ${data.businessName}.`,
      "",
      `Prestation : ${data.serviceName}`,
      `Souhaité : ${when}`,
      "",
      `Nom : ${data.name}`,
      `E-mail : ${data.email}`,
      data.phone ? `Téléphone : ${data.phone}` : null,
      data.note ? `\nMessage :\n${data.note}` : null,
      "",
      "Répondez directement à ce courriel pour confirmer avec le client.",
      "",
      "Rappel : cette demande n'est pas une réservation ferme. Le client attend",
      "votre confirmation.",
    ]
      .filter((line) => line !== null)
      .join("\n"),
  };
}

/**
 * Accusé de réception au client final. Il évite l'appel « est-ce que ma
 * demande est passée ? » et dit clairement que rien n'est encore confirmé.
 */
export function bookingToCustomer(data: BookingMailData): {
  subject: string;
  text: string;
} {
  const when = `${data.preferredDate} — ${periodLabel(data.preferredPeriod, data.locale)}`;

  const bodies: Record<Language, string[]> = {
    fr: [
      `Bonjour ${data.name},`,
      "",
      `Nous avons bien reçu votre demande de rendez-vous chez ${data.businessName} :`,
      `${data.serviceName}, ${when}.`,
      "",
      "Il ne s'agit pas encore d'une réservation confirmée : le salon revient",
      "vers vous rapidement pour fixer l'horaire exact.",
      "",
      "À bientôt.",
    ],
    nl: [
      `Beste ${data.name},`,
      "",
      `We hebben uw aanvraag bij ${data.businessName} goed ontvangen:`,
      `${data.serviceName}, ${when}.`,
      "",
      "Dit is nog geen bevestigde afspraak: de zaak neemt binnenkort contact",
      "met u op om het precieze uur vast te leggen.",
      "",
      "Tot binnenkort.",
    ],
    en: [
      `Hello ${data.name},`,
      "",
      `We have received your appointment request at ${data.businessName}:`,
      `${data.serviceName}, ${when}.`,
      "",
      "This is not a confirmed booking yet — the shop will get back to you",
      "shortly to agree on the exact time.",
      "",
      "See you soon.",
    ],
  };

  const subjects: Record<Language, string> = {
    fr: `Votre demande de rendez-vous — ${data.businessName}`,
    nl: `Uw afspraakaanvraag — ${data.businessName}`,
    en: `Your appointment request — ${data.businessName}`,
  };

  return { subject: subjects[data.locale], text: bodies[data.locale].join("\n") };
}

export function contactToBusiness(data: {
  businessName: string;
  name: string;
  email: string;
  message: string;
}): { subject: string; text: string } {
  return {
    subject: `Message depuis le site — ${data.name}`,
    text: [
      `Nouveau message depuis le site de ${data.businessName}.`,
      "",
      `Nom : ${data.name}`,
      `E-mail : ${data.email}`,
      "",
      data.message,
      "",
      "Répondez directement à ce courriel.",
    ].join("\n"),
  };
}

/**
 * Une demande de commande, telle qu'elle arrive dans la boîte du commerçant.
 *
 * Écrite pour être lue sur un téléphone, entre deux clients, sans ouvrir de
 * console : tout ce qu'il faut pour rappeler et commencer à composer est dans
 * le corps du message. L'ordre suit l'urgence — pour quand, pour qui, combien,
 * où — et non l'ordre du formulaire.
 *
 * Le mot de la carte est recopié tel quel, ponctuation comprise. Le fleuriste
 * l'écrira à la main : une reformulation « propre » de notre part se
 * retrouverait sur la carte, et ce n'est pas notre texte.
 */
export function orderToBusiness(data: {
  businessName: string;
  name: string;
  email: string;
  phone?: string;
  occasion?: string;
  budget?: number;
  wantedDate?: string;
  mode: "delivery" | "pickup";
  address?: string;
  card?: string;
  note?: string;
  locale: string;
}): { subject: string; text: string } {
  const quand = data.wantedDate
    ? new Date(`${data.wantedDate}T12:00:00`).toLocaleDateString("fr-BE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "dès que possible";

  const lignes = [
    `Nouvelle demande de commande pour ${data.businessName}.`,
    "",
    `Pour       : ${quand}`,
    `Remise     : ${data.mode === "delivery" ? "livraison" : "retrait en boutique"}`,
  ];

  if (data.address) lignes.push(`Adresse    : ${data.address}`);
  if (data.occasion) lignes.push(`Occasion   : ${data.occasion}`);
  if (data.budget !== undefined) lignes.push(`Budget     : ${data.budget} €`);

  lignes.push(
    "",
    `Client     : ${data.name}`,
    `Courriel   : ${data.email}`,
    ...(data.phone ? [`Téléphone  : ${data.phone}`] : []),
  );

  if (data.card) {
    lignes.push("", "Mot pour la carte, à recopier tel quel :", `« ${data.card} »`);
  }
  if (data.note) {
    lignes.push("", "Précisions du client :", data.note);
  }

  lignes.push(
    "",
    "Rien n'a été encaissé et rien n'est confirmé : rappelez le client pour",
    "convenir de ce que vous pouvez composer.",
    "",
    "Répondre à ce courriel écrit directement au client.",
  );

  return {
    subject: `Demande de commande — ${quand} — ${data.name}`,
    text: lignes.join("\n"),
  };
}
