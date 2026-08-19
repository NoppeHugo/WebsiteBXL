import type { Language } from "@bxl/schema";
import { metierDe, prendCommandes } from "@bxl/schema/metiers";
import { site, path } from "./client.ts";
import { apiConfigured } from "./api.ts";

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
 * Cible du bouton principal, selon ce que le commerce prend : un rendez-vous
 * ou une commande.
 *
 * Tant que l'API de réservation n'existe pas (phases 3 et 4 du README), les
 * modes `request` et `live` réservent leur emplacement dans la page : le
 * template est prêt, seul le widget reste à brancher.
 *
 * Le métier passe avant `booking.mode`, et c'est ce qui manquait : un
 * fleuriste déclare `mode: "none"` — il ne réserve rien — et le bouton
 * disparaissait alors du menu et de la barre d'action, alors que sa page
 * porte un formulaire de commande. Il fallait dérouler tout le site pour le
 * trouver. Le bouton dit désormais « Commander » et descend à `#commande`.
 *
 * Une adresse externe explicite garde la priorité : elle a été saisie exprès,
 * et c'est là que le commerce veut envoyer ses clients.
 */
export function bookingTarget(lang: Language): BookingTarget {
  if (site.booking.mode !== "external" && prendCommandes(site.business.type)) {
    /*
     * Deux formulaires, deux ancres : un restaurant descend vers « Réserver
     * une table », un fleuriste vers « Commander ». Le libellé du bouton, lui,
     * vient du vocabulaire du métier (i18n.ts) — il n'est pas décidé ici.
     */
    const ancre = metierDe(site.business.type).commande === "table" ? "table" : "commande";
    return {
      /*
       * Exactement la condition du formulaire lui-même (voir Commande.astro
       * et Table.astro) :
       * toute la section disparaît sans `tenantId` ou sans `PUBLIC_API_URL`,
       * contrairement à la réservation dont le bloc reste, avec son téléphone.
       * Un bouton qui pointe vers une ancre absente ne fait rien du tout, et
       * c'est la panne qu'on ne remarque qu'en démonstration.
       */
      enabled: Boolean(site.tenantId) && apiConfigured,
      href: `${path(lang)}#${ancre}`,
      external: false,
      widget: false,
    };
  }

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
