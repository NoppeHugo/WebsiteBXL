import { z } from "zod";
import { Language } from "./index.ts";

/**
 * Contrat des messages entrants, partagé par le formulaire du site et l'API.
 *
 * Le même schéma valide des deux côtés : le navigateur pour l'ergonomie, le
 * serveur parce qu'une validation côté client ne protège de rien. Les deux ne
 * peuvent pas diverger puisqu'ils lisent ce fichier.
 */

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date au format YYYY-MM-DD");

const Time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "heure au format HH:MM");

/**
 * Créneau souhaité, volontairement approximatif en v1 : le salon confirme
 * manuellement, donc demander une heure précise donnerait au client
 * l'illusion d'une réservation ferme.
 */
export const PreferredPeriod = z.enum(["morning", "afternoon", "evening"]);
export type PreferredPeriod = z.infer<typeof PreferredPeriod>;

const Consent = z
  .union([z.literal("on"), z.literal("true"), z.boolean()])
  .refine((v) => v === true || v === "on" || v === "true", {
    message: "consentement requis",
  });

/**
 * Champ piège. Volontairement permissif ici : c'est la route qui décide quoi
 * faire d'une valeur non vide. Le rejeter au niveau du schéma renverrait une
 * erreur de validation au robot — et rendrait inatteignable la réponse en
 * faux succès, qui ne lui apprend rien sur ce qui l'a trahi.
 */
const Honeypot = z.string().max(200).optional();

/**
 * URL de retour, restreinte à http(s).
 *
 * `z.string().url()` accepte `javascript:` et `data:` — ce sont des URL
 * valides. La route revérifie l'origine, ce qui les rejetterait de toute
 * façon, mais une défense qui ne tient que par son second étage finit par
 * tomber le jour où le premier change.
 */
const ReturnUrl = z
  .string()
  .url()
  .max(300)
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "seules les adresses http et https sont acceptées" },
  );

const Customer = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export const BookingRequestInput = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().min(1).max(80),
  /** Libellé affiché au client, repris tel quel dans le courriel au salon. */
  serviceName: z.string().trim().max(160).optional().or(z.literal("")),
  preferredDate: IsoDate,
  preferredPeriod: PreferredPeriod,
  name: Customer.shape.name,
  email: Customer.shape.email,
  phone: Customer.shape.phone,
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  locale: Language.default("fr"),
  consent: Consent,
  _company: Honeypot,
  /**
   * Page de retour pour l'envoi sans JavaScript. Toujours revérifiée contre
   * l'origine déclarée du client côté serveur : accepter une URL arbitraire
   * ferait de l'API une redirection ouverte, utilisable pour du hameçonnage.
   */
  redirectTo: ReturnUrl.optional().or(z.literal("")),
});
export type BookingRequestInput = z.infer<typeof BookingRequestInput>;

/**
 * Comment le client veut récupérer ses fleurs.
 *
 * Un fleuriste qui ne livre pas n'affiche pas le choix, et le formulaire poste
 * alors « pickup » — plutôt qu'un état « non précisé » dont personne ne
 * saurait quoi faire.
 *
 * `table` est la demande de table d'un restaurant. Elle passe par la même
 * route et la même table en base : c'est la même chose — une intention datée
 * que le commerce rappelle pour confirmer — avec une heure et un nombre de
 * couverts à la place de l'occasion et de l'adresse.
 */
export const OrderMode = z.enum(["delivery", "pickup", "table"]);
export type OrderMode = z.infer<typeof OrderMode>;

/**
 * Demande de commande, pour les métiers qui ne prennent pas rendez-vous.
 *
 * Ce n'est **pas** une vente : aucun paiement, aucun engagement de prix. Un
 * fleuriste ne peut pas promettre à l'avance ce qu'il composera — cela dépend
 * de l'arrivage du matin. Il rappelle, confirme, puis compose.
 *
 * Le budget est donc une intention, pas un montant dû ; et la date est
 * souhaitée, pas retenue. Les nommer autrement ferait croire à une commande
 * ferme, et le premier client déçu aurait raison de se plaindre.
 */
export const OrderRequestInput = z.object({
  tenantId: z.string().uuid(),
  /** Identifiant de l'occasion choisie, ou vide si le client n'a pas choisi. */
  occasionId: z.string().max(80).optional().or(z.literal("")),
  /** Libellé affiché, repris tel quel dans le courriel au commerçant. */
  occasionName: z.string().trim().max(160).optional().or(z.literal("")),
  /** En euros. Une intention de dépense, jamais un montant dû. */
  budget: z.coerce.number().int().min(0).max(100000).optional(),
  /** Date souhaitée. Facultative : « dès que possible » est une réponse. */
  wantedDate: IsoDate.optional().or(z.literal("")),
  mode: OrderMode.default("pickup"),
  /**
   * Heure souhaitée, pour une table. La route l'exige quand le mode est
   * `table`, et l'ignore partout ailleurs — un bouquet n'a pas d'heure.
   */
  wantedTime: Time.optional().or(z.literal("")),
  /** Nombre de couverts. Borné haut : au-delà, c'est une privatisation. */
  partySize: z.coerce.number().int().min(1).max(200).optional(),
  /** Adresse de livraison, exigée par la route quand le mode est `delivery`. */
  address: z.string().trim().max(300).optional().or(z.literal("")),
  /**
   * Mot à recopier sur la carte. Le fleuriste l'écrit à la main : c'est
   * souvent la partie du bouquet à laquelle le client tient le plus, et une
   * faute de frappe s'y voit pour toujours sur une photo de famille.
   */
  card: z.string().trim().max(500).optional().or(z.literal("")),
  name: Customer.shape.name,
  email: Customer.shape.email,
  phone: Customer.shape.phone,
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  locale: Language.default("fr"),
  consent: Consent,
  _company: Honeypot,
  redirectTo: ReturnUrl.optional().or(z.literal("")),
});
export type OrderRequestInput = z.infer<typeof OrderRequestInput>;

export const ContactMessageInput = z.object({
  tenantId: z.string().uuid(),
  name: Customer.shape.name,
  email: Customer.shape.email,
  message: z.string().trim().min(2).max(4000),
  locale: Language.default("fr"),
  consent: Consent,
  _company: Honeypot,
  redirectTo: ReturnUrl.optional().or(z.literal("")),
});
export type ContactMessageInput = z.infer<typeof ContactMessageInput>;

/**
 * Une demande ne peut pas viser une date passée, ni un horizon absurde.
 * Bornes larges à dessein : c'est le salon qui juge de sa disponibilité, pas
 * le formulaire.
 */
export function isAcceptableDate(date: string, today = new Date()): boolean {
  const asked = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(asked.getTime())) return false;

  const start = new Date(today);
  start.setUTCHours(0, 0, 0, 0);

  const limit = new Date(start);
  limit.setUTCFullYear(limit.getUTCFullYear() + 1);

  return asked >= start && asked <= limit;
}
