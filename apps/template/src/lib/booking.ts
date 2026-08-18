import type { Language } from "@bxl/schema";
import { site, path } from "./client.ts";

export interface BookingTarget {
  /** Faut-il afficher un bouton de réservation ? */
  enabled: boolean;
  href: string;
  /** Ouvre chez un prestataire externe : nouvel onglet. */
  external: boolean;
  /** Le widget maison doit être monté sur la page. */
  widget: boolean;
}

/**
 * Cible du bouton « Prendre rendez-vous », selon le mode déclaré par le client.
 *
 * Tant que l'API de réservation n'existe pas (phases 3 et 4 du README), les
 * modes `request` et `live` réservent leur emplacement dans la page : le
 * template est prêt, seul le widget reste à brancher.
 */
export function bookingTarget(lang: Language): BookingTarget {
  switch (site.booking.mode) {
    case "external":
      return {
        enabled: true,
        href: site.booking.url,
        external: true,
        widget: false,
      };
    case "request":
    case "live":
      return {
        enabled: true,
        href: `${path(lang)}#reservation`,
        external: false,
        widget: true,
      };
    case "none":
      return {
        enabled: false,
        href: `tel:${site.business.phone.replace(/\s/g, "")}`,
        external: false,
        widget: false,
      };
  }
}

/**
 * Lien téléphonique.
 *
 * Accepte un numéro : les fleurs de deuil peuvent avoir une ligne distincte de
 * celle du commerce, joignable en dehors des heures d'ouverture. À défaut,
 * c'est le numéro principal.
 */
export function telHref(numero?: string): string {
  return `tel:${(numero ?? site.business.phone).replace(/[\s.]/g, "")}`;
}

/**
 * Lien d'itinéraire. On privilégie l'URL Google Maps du client quand elle
 * existe : c'est elle qui pointe vers sa fiche Google Business, celle qu'on
 * cherche justement à faire remonter.
 */
export function directionsHref(): string {
  if (site.business.googleMapsUrl) return site.business.googleMapsUrl;
  const { street, postalCode, city, country } = site.business.address;
  const query = encodeURIComponent(
    `${site.business.name}, ${street}, ${postalCode} ${city}, ${country}`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
