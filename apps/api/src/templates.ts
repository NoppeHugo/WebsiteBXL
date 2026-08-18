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
export interface OrderMailData {
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
  locale: Language;
}

/**
 * « samedi 12 septembre », dans la langue voulue, ou la formule d'attente
 * quand aucune date n'a été donnée — une commande sans date reste une
 * commande, et « (vide) » dans un courriel fait douter de tout le reste.
 */
function orderDate(wantedDate: string | undefined, lang: Language): string {
  const asap: Record<Language, string> = {
    fr: "dès que possible",
    nl: "zo snel mogelijk",
    en: "as soon as possible",
  };
  if (!wantedDate) return asap[lang];
  return new Date(`${wantedDate}T12:00:00`).toLocaleDateString(`${lang}-BE`, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function orderToBusiness(data: OrderMailData): {
  subject: string;
  text: string;
} {
  const quand = orderDate(data.wantedDate, "fr");

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

/**
 * Accusé de réception au client qui commande.
 *
 * Il manquait, alors que la demande de rendez-vous en avait un depuis le début.
 * Quelqu'un venait de confier un budget, une adresse et le mot à écrire sur la
 * carte — c'est-à-dire ce à quoi il tient le plus — et repartait sans la
 * moindre trace écrite.
 *
 * Le mot de la carte lui est relu tel qu'il l'a écrit : c'est le seul moment où
 * une faute de frappe peut encore être corrigée avant qu'elle ne se retrouve
 * sur une photo de famille.
 *
 * Le message répète deux choses, parce que ce sont les deux malentendus qui
 * coûteraient cher : rien n'a été payé, et rien n'est encore confirmé.
 */
export function orderToCustomer(data: OrderMailData): {
  subject: string;
  text: string;
} {
  const quand = orderDate(data.wantedDate, data.locale);

  const recapitulatif: Record<Language, string[]> = {
    fr: [
      `Pour : ${quand}`,
      data.mode === "delivery"
        ? `Livraison : ${data.address ?? ""}`
        : "À retirer en boutique",
      ...(data.occasion ? [`Occasion : ${data.occasion}`] : []),
      ...(data.budget !== undefined ? [`Budget indiqué : ${data.budget} €`] : []),
    ],
    nl: [
      `Voor: ${quand}`,
      data.mode === "delivery"
        ? `Levering: ${data.address ?? ""}`
        : "Af te halen in de winkel",
      ...(data.occasion ? [`Gelegenheid: ${data.occasion}`] : []),
      ...(data.budget !== undefined ? [`Opgegeven budget: ${data.budget} €`] : []),
    ],
    en: [
      `For: ${quand}`,
      data.mode === "delivery"
        ? `Delivery: ${data.address ?? ""}`
        : "To collect in the shop",
      ...(data.occasion ? [`Occasion: ${data.occasion}`] : []),
      ...(data.budget !== undefined ? [`Budget given: ${data.budget} €`] : []),
    ],
  };

  const carte: Record<Language, string[]> = {
    fr: ["", "Mot pour la carte, tel que nous l'avons reçu :", `« ${data.card} »`],
    nl: ["", "Boodschap voor het kaartje, zoals ontvangen:", `« ${data.card} »`],
    en: ["", "Message for the card, exactly as received:", `“${data.card}”`],
  };

  const corps: Record<Language, string[]> = {
    fr: [
      `Bonjour ${data.name},`,
      "",
      `Nous avons bien reçu votre demande de commande chez ${data.businessName} :`,
      ...recapitulatif.fr,
      ...(data.card ? carte.fr : []),
      "",
      "Rien n'a été payé et rien n'est encore confirmé : le fleuriste vous",
      "recontacte pour convenir de ce qu'il peut composer avec les fleurs du",
      "moment.",
      "",
      "À bientôt.",
    ],
    nl: [
      `Beste ${data.name},`,
      "",
      `We hebben uw bestelaanvraag bij ${data.businessName} goed ontvangen:`,
      ...recapitulatif.nl,
      ...(data.card ? carte.nl : []),
      "",
      "Er is niets betaald en niets is al bevestigd: de bloemist neemt contact",
      "met u op om te bespreken wat hij met de bloemen van het moment kan maken.",
      "",
      "Tot binnenkort.",
    ],
    en: [
      `Hello ${data.name},`,
      "",
      `We have received your order request at ${data.businessName}:`,
      ...recapitulatif.en,
      ...(data.card ? carte.en : []),
      "",
      "Nothing has been paid and nothing is confirmed yet — the florist will",
      "get back to you to agree on what can be made with the flowers of the day.",
      "",
      "See you soon.",
    ],
  };

  const sujets: Record<Language, string> = {
    fr: `Votre demande de commande — ${data.businessName}`,
    nl: `Uw bestelaanvraag — ${data.businessName}`,
    en: `Your order request — ${data.businessName}`,
  };

  return { subject: sujets[data.locale], text: corps[data.locale].join("\n") };
}
