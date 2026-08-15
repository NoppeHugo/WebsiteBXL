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
