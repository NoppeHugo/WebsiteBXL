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
