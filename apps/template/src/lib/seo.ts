import type { Language } from "@bxl/schema";
import { WEEKDAYS } from "@bxl/schema";
import { site, t } from "./client.ts";

/** Correspondance vers les types schema.org reconnus par Google. */
const SCHEMA_TYPE: Record<string, string> = {
  hair_salon: "HairSalon",
  barbershop: "HairSalon",
  beauty_salon: "BeautySalon",
  bakery: "Bakery",
  florist: "Florist",
  other: "LocalBusiness",
};

const SCHEMA_DAY: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/**
 * Données structurées LocalBusiness.
 *
 * C'est la moitié technique de l'argument « on ne me trouve pas sur Google » :
 * horaires, adresse et téléphone lisibles par Google, cohérents avec la fiche
 * Google Business.
 *
 * Volontairement absent : `aggregateRating` et `review`. Google interdit le
 * balisage d'avis auto-déclarés sur son propre site et sanctionne la pratique —
 * les avis restent affichés aux visiteurs, mais ne sont pas balisés.
 */
export function localBusinessJsonLd(
  lang: Language,
  base: URL | undefined,
  imageUrl?: string,
): Record<string, unknown> {
  const openingHours = WEEKDAYS.flatMap((day) =>
    site.hours[day].map((slot) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${SCHEMA_DAY[day]}`,
      opens: slot.open,
      closes: slot.close,
    })),
  );

  const sameAs = Object.values(site.business.social).filter(Boolean);

  /*
   * Fourchette de prix. Google l'affiche dans les résultats locaux, où elle
   * fait partie de ce qui décide un passant à cliquer plutôt qu'à faire
   * défiler. Les prestations sur devis sont ignorées : elles n'ont pas de
   * montant à moyenner.
   */
  const prices = site.services
    .map((s) => s.price)
    .filter((p): p is number => p !== null);
  const priceRange =
    prices.length === 0
      ? undefined
      : `${Math.min(...prices)}–${Math.max(...prices)} €`;

  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[site.business.type] ?? "LocalBusiness",
    /*
     * Identifiant stable du commerce, le même dans les trois langues. Sans
     * lui, Google voit trois fiches concurrentes là où il n'y a qu'un salon,
     * et répartit entre elles la confiance qu'il devrait accorder à une seule.
     */
    ...(base && { "@id": `${base.origin}/#business` }),
    name: site.business.name,
    description: t(site.business.description, lang),
    url: base?.href,
    telephone: site.business.phone,
    ...(site.business.email && { email: site.business.email }),
    address: {
      "@type": "PostalAddress",
      streetAddress: site.business.address.street,
      postalCode: site.business.address.postalCode,
      addressLocality: site.business.address.city,
      addressCountry: site.business.address.country,
    },
    ...(site.business.geo && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: site.business.geo.lat,
        longitude: site.business.geo.lng,
      },
    }),
    ...(imageUrl && { image: imageUrl }),
    ...(priceRange && { priceRange }),
    /*
     * Lien vers la fiche Google du commerce. C'est le rattachement explicite
     * entre le site et la fiche — les deux moitiés de l'argument d'entrée du
     * pack, qui ne servent à rien tant qu'elles s'ignorent.
     */
    ...(site.business.googleMapsUrl && { hasMap: site.business.googleMapsUrl }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(openingHours.length > 0 && { openingHoursSpecification: openingHours }),
    ...(site.services.length > 0 && {
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: t(site.business.tagline, lang) || site.business.name,
        itemListElement: site.services.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: t(s.name, lang) },
          ...(s.price !== null && {
            price: s.price,
            priceCurrency: "EUR",
          }),
        })),
      },
    }),
  };
}
