import type { Language } from "@bxl/schema";
import { WEEKDAYS } from "@bxl/schema";
import { site, t } from "./client.ts";

/**
 * Correspondance vers les types schema.org reconnus par Google.
 *
 * Tous nos types de commerce n'ont pas d'équivalent : schema.org ne connaît
 * ni boucher, ni chocolatier, ni traiteur. On remonte alors au type parent le
 * plus proche — `Store`, `FoodEstablishment` — plutôt que d'inventer un nom :
 * un type inconnu de Google est ignoré en bloc, et le commerce perd du même
 * coup ses horaires et son adresse, qui eux étaient bons.
 */
const SCHEMA_TYPE: Record<string, string> = {
  /* Soins et rendez-vous. */
  hair_salon: "HairSalon",
  barbershop: "HairSalon",
  beauty_salon: "BeautySalon",
  nail_salon: "NailSalon",
  day_spa: "DaySpa",
  massage: "HealthAndBeautyBusiness",
  optician: "Optician",
  pet_grooming: "PetStore",
  veterinary: "VeterinaryCare",
  tattoo_parlor: "TattooParlor",

  /* Projets sur devis. */
  photographer: "ProfessionalService",
  print_shop: "Store",

  /* Commerces de bouche et de détail. */
  florist: "Florist",
  bakery: "Bakery",
  pastry_shop: "Bakery",
  ice_cream: "IceCreamShop",
  chocolate_shop: "Store",
  caterer: "FoodEstablishment",
  butcher: "Store",
  fishmonger: "Store",
  wine_store: "LiquorStore",
  brewery: "Brewery",
  deli: "GroceryStore",
  grocery: "GroceryStore",
  greengrocer: "GroceryStore",
  cheese_shop: "Store",
  coffee_roaster: "Store",

  /* Table, comptoir, salle. */
  restaurant: "Restaurant",
  cafe: "CafeOrCoffeeShop",
  bar: "BarOrPub",
  tea_room: "CafeOrCoffeeShop",
  fast_food: "FastFoodRestaurant",
  food_truck: "FoodEstablishment",
  sandwich_shop: "FastFoodRestaurant",
  gym: "HealthClub",
  yoga_studio: "HealthClub",
  dance_studio: "SportsActivityLocation",
  climbing_gym: "ExerciseGym",

  /* Écoles, boutiques et services de quartier. */
  driving_school: "EducationalOrganization",
  language_school: "EducationalOrganization",
  music_school: "EducationalOrganization",
  clothing_store: "ClothingStore",
  shoe_store: "ShoeStore",
  jewelry_store: "JewelryStore",
  book_store: "BookStore",
  home_goods_store: "HomeGoodsStore",
  bike_store: "BikeStore",
  pet_store: "PetStore",
  toy_store: "ToyStore",
  dry_cleaner: "DryCleaningOrLaundry",
  /*
   * Ni cordonnier, ni retoucheur, ni réparateur chez schema.org. `LocalBusiness`
   * est le parent commun : Google le lit, avec les horaires et l'adresse — ce
   * qui est précisément ce qu'on cherche à faire remonter pour ces commerces.
   */
  shoe_repair: "LocalBusiness",
  tailor: "LocalBusiness",
  repair_shop: "LocalBusiness",

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
