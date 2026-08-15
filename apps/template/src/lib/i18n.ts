import type { Language, Weekday } from "@bxl/schema";

/**
 * Libellés d'interface du template — distincts du contenu du client, qui vit
 * dans `site.json`. Ajouter une langue ici la rend disponible pour tous les
 * clients d'un coup : c'est le principe « on ne corrige qu'une fois ».
 */
const strings = {
  fr: {
    nav_services: "Prestations",
    nav_gallery: "Galerie",
    nav_team: "L'équipe",
    nav_hours: "Horaires",
    nav_contact: "Contact",
    book: "Prendre rendez-vous",
    book_short: "Réserver",
    call: "Appeler",
    itinerary: "Itinéraire",
    services_title: "Prestations & tarifs",
    gallery_title: "Le salon",
    team_title: "L'équipe",
    reviews_title: "Ils en parlent",
    cta_title: "Envie de passer ?",
    hours_title: "Horaires d'ouverture",
    contact_title: "Nous trouver",
    closed: "Fermé",
    minutes: "min",
    skip_to_content: "Aller au contenu",
    menu: "Menu",
    close: "Fermer",
    lang_label: "Langue",
    demo_notice: "Site de démonstration — commerce fictif.",
    suspended_title: "Site temporairement indisponible",
    suspended_body:
      "Ce site est momentanément hors ligne. Le commerce reste joignable par téléphone.",
    legal: "Mentions légales",
    legal_title: "Mentions légales",
    legal_publisher: "Éditeur du site",
    legal_company: "Entreprise",
    legal_vat: "Numéro de TVA",
    legal_registration: "Numéro d'entreprise",
    legal_hosting: "Hébergement",
    legal_address: "Adresse",
    legal_contact: "Contact",
    legal_editor: "Éditeur responsable",
    legal_privacy_title: "Données personnelles",
    legal_privacy_body:
      "Ce site ne dépose aucun cookie publicitaire et n'utilise aucun traceur tiers. La fréquentation est mesurée de façon anonyme, sans cookie. Les données transmises via le formulaire de contact servent uniquement à répondre à votre demande et ne sont ni revendues ni transmises à des tiers. Vous pouvez demander leur consultation ou leur suppression en écrivant à l'adresse ci-dessus.",
    form_title: "Écrire un message",
    form_name: "Votre nom",
    form_email: "Votre e-mail",
    form_message: "Votre message",
    form_consent:
      "J'accepte que mes coordonnées soient utilisées pour répondre à ma demande.",
    form_send: "Envoyer",
    form_sending: "Envoi…",
    form_ok: "Message envoyé. Nous vous répondons rapidement.",
    form_error:
      "L'envoi a échoué. Vous pouvez nous joindre par téléphone en attendant.",
    back_home: "Retour à l'accueil",
    made_by: "Site & photographies",
  },
  nl: {
    nav_services: "Diensten",
    nav_gallery: "Galerij",
    nav_team: "Het team",
    nav_hours: "Openingsuren",
    nav_contact: "Contact",
    book: "Afspraak maken",
    book_short: "Reserveren",
    call: "Bellen",
    itinerary: "Route",
    services_title: "Diensten & tarieven",
    gallery_title: "De zaak",
    team_title: "Het team",
    reviews_title: "Wat men zegt",
    cta_title: "Zin om langs te komen?",
    hours_title: "Openingsuren",
    contact_title: "Ons vinden",
    closed: "Gesloten",
    minutes: "min",
    skip_to_content: "Naar de inhoud",
    menu: "Menu",
    close: "Sluiten",
    lang_label: "Taal",
    demo_notice: "Demonstratiesite — fictieve zaak.",
    suspended_title: "Site tijdelijk niet beschikbaar",
    suspended_body:
      "Deze site is tijdelijk offline. De zaak blijft telefonisch bereikbaar.",
    legal: "Juridische informatie",
    legal_title: "Juridische informatie",
    legal_publisher: "Uitgever van de site",
    legal_company: "Onderneming",
    legal_vat: "Btw-nummer",
    legal_registration: "Ondernemingsnummer",
    legal_hosting: "Hosting",
    legal_address: "Address",
    legal_contact: "Contact",
    legal_editor: "Responsible publisher",
    legal_address: "Adres",
    legal_contact: "Contact",
    legal_editor: "Verantwoordelijke uitgever",
    legal_privacy_title: "Persoonsgegevens",
    legal_privacy_body:
      "Deze site plaatst geen advertentiecookies en gebruikt geen trackers van derden. Het bezoek wordt anoniem gemeten, zonder cookies. Gegevens die via het contactformulier worden verzonden, dienen enkel om uw vraag te beantwoorden en worden niet verkocht of doorgegeven aan derden. U kunt inzage of verwijdering vragen via het bovenstaande adres.",
    form_title: "Een bericht sturen",
    form_name: "Uw naam",
    form_email: "Uw e-mailadres",
    form_message: "Uw bericht",
    form_consent:
      "Ik ga ermee akkoord dat mijn gegevens worden gebruikt om mijn vraag te beantwoorden.",
    form_send: "Versturen",
    form_sending: "Bezig…",
    form_ok: "Bericht verzonden. We antwoorden u snel.",
    form_error:
      "Verzenden mislukt. U kunt ons intussen telefonisch bereiken.",
    back_home: "Terug naar de startpagina",
    made_by: "Site & fotografie",
  },
  en: {
    nav_services: "Services",
    nav_gallery: "Gallery",
    nav_team: "The team",
    nav_hours: "Opening hours",
    nav_contact: "Contact",
    book: "Book an appointment",
    book_short: "Book now",
    call: "Call",
    itinerary: "Directions",
    services_title: "Services & prices",
    gallery_title: "The space",
    team_title: "The team",
    reviews_title: "What people say",
    cta_title: "Ready for a visit?",
    hours_title: "Opening hours",
    contact_title: "Find us",
    closed: "Closed",
    minutes: "min",
    skip_to_content: "Skip to content",
    menu: "Menu",
    close: "Close",
    lang_label: "Language",
    demo_notice: "Demonstration site — fictional business.",
    suspended_title: "Site temporarily unavailable",
    suspended_body:
      "This site is temporarily offline. The business can still be reached by phone.",
    legal: "Legal notice",
    legal_title: "Legal notice",
    legal_publisher: "Site publisher",
    legal_company: "Company",
    legal_vat: "VAT number",
    legal_registration: "Company number",
    legal_hosting: "Hosting",
    legal_privacy_title: "Personal data",
    legal_privacy_body:
      "This site sets no advertising cookies and uses no third-party trackers. Traffic is measured anonymously, without cookies. Data sent through the contact form is used solely to answer your enquiry and is never sold or passed to third parties. You may request access or deletion at the address above.",
    form_title: "Send a message",
    form_name: "Your name",
    form_email: "Your email",
    form_message: "Your message",
    form_consent:
      "I agree that my details may be used to answer my enquiry.",
    form_send: "Send",
    form_sending: "Sending…",
    form_ok: "Message sent. We will reply shortly.",
    form_error: "Sending failed. You can reach us by phone in the meantime.",
    back_home: "Back to home",
    made_by: "Website & photography",
  },
} as const satisfies Record<Language, Record<string, string>>;

export type UiKey = keyof (typeof strings)["fr"];

export function ui(lang: Language, key: UiKey): string {
  return strings[lang][key];
}

const weekdayNames: Record<Language, Record<Weekday, string>> = {
  fr: {
    monday: "Lundi",
    tuesday: "Mardi",
    wednesday: "Mercredi",
    thursday: "Jeudi",
    friday: "Vendredi",
    saturday: "Samedi",
    sunday: "Dimanche",
  },
  nl: {
    monday: "Maandag",
    tuesday: "Dinsdag",
    wednesday: "Woensdag",
    thursday: "Donderdag",
    friday: "Vrijdag",
    saturday: "Zaterdag",
    sunday: "Zondag",
  },
  en: {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  },
};

export function weekday(lang: Language, day: Weekday): string {
  return weekdayNames[lang][day];
}

/** Code de langue HTML complet, utile pour `lang=""` et hreflang. */
export function htmlLang(lang: Language): string {
  return { fr: "fr-BE", nl: "nl-BE", en: "en" }[lang];
}
