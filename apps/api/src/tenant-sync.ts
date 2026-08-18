import type { Sql } from "postgres";
import type { SiteConfig } from "@bxl/schema";

/**
 * Projection du contenu d'un commerce vers la base.
 *
 * Les horaires, les prestations, les fermetures et l'équipe vivent dans git :
 * c'est le `site.json` qui fait foi, et lui seul. Mais l'agenda en a besoin à
 * chaque requête, et l'API n'a pas accès au dépôt — elle tourne dans un
 * conteneur qui ne le monte pas. On en dépose donc ici une copie, réécrite
 * intégralement à chaque enregistrement et jamais éditée de ce côté.
 *
 * Cette fonction a été sortie de `cli/upsert-tenant.ts` pour une raison
 * précise : la console d'administration ne pouvait pas l'appeler. Un horaire
 * modifié dans l'éditeur de contenu partait bien dans git et s'affichait bien
 * sur le site — mais la base gardait l'ancien, et le formulaire de réservation
 * continuait de proposer des créneaux d'un jour désormais fermé. Rien ne
 * signalait l'écart : le site disait « fermé le lundi », la prise de
 * rendez-vous acceptait le lundi.
 *
 * Elle ne touche pas aux rendez-vous déjà pris. Un créneau qui sort des
 * horaires après coup reste au calendrier : l'annuler pour cause de
 * changement d'horaire est une décision du salon, pas d'un script.
 */

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface TenantSyncResult {
  tenantId: string;
  services: number;
  /** Personnes qui peuvent recevoir en parallèle. */
  resources: number;
  notifyEmail: string;
  origin: string;
}

export async function syncTenant(
  sql: Sql,
  site: SiteConfig,
  options: { tenantId: string; notifyEmail: string },
): Promise<TenantSyncResult> {
  const { tenantId, notifyEmail } = options;

  // L'origine autorisée à appeler l'API est le domaine du client, en HTTPS.
  const origin = `https://${site.domain}`;

  await sql`
    insert into tenants (id, slug, business_name, notify_email, origin)
    values (${tenantId}, ${site.slug}, ${site.business.name}, ${notifyEmail}, ${origin})
    on conflict (id) do update set
      slug          = excluded.slug,
      business_name = excluded.business_name,
      notify_email  = excluded.notify_email,
      origin        = excluded.origin,
      updated_at    = now()
  `;

  /*
   * Seules les prestations qui ont une durée entrent en base.
   *
   * Cette table n'existe que pour l'agenda : c'est elle qu'il lit pour savoir
   * combien de temps occupe un rendez-vous. Une composition florale n'a pas de
   * durée et ne se réserve pas ; lui en inventer une pour satisfaire la
   * colonne mettrait dans l'agenda des lignes que rien ne viendra jamais
   * réserver, et fausserait le jour où l'on comptera ce qui se vend.
   *
   * Le schéma garantit qu'une durée est présente dès que le site prend des
   * rendez-vous : ce filtre ne peut donc pas faire disparaître une prestation
   * réservable.
   */
  await sql`delete from tenant_services where tenant_id = ${tenantId}`;
  for (const service of site.services) {
    if (service.durationMin === undefined) continue;
    await sql`
      insert into tenant_services (tenant_id, service_id, name, duration_min, price_cents)
      values (
        ${tenantId}, ${service.id},
        ${service.name[site.languages.default] ?? service.id},
        ${service.durationMin},
        ${service.price === null ? null : Math.round(service.price * 100)}
      )
    `;
  }

  await sql`delete from tenant_hours where tenant_id = ${tenantId}`;
  for (const [day, index] of Object.entries(WEEKDAY_INDEX)) {
    for (const slot of site.hours[day as keyof typeof site.hours]) {
      await sql`
        insert into tenant_hours (tenant_id, weekday, opens, closes)
        values (${tenantId}, ${index}, ${slot.open}, ${slot.close})
        on conflict do nothing
      `;
    }
  }

  await sql`delete from tenant_closures where tenant_id = ${tenantId}`;
  for (const closure of site.closures) {
    await sql`
      insert into tenant_closures (tenant_id, from_day, to_day)
      values (${tenantId}, ${closure.from}, ${closure.to})
      on conflict do nothing
    `;
  }

  /*
   * L'équipe affichée sur le site est aussi la liste des personnes qui peuvent
   * recevoir : un salon à trois fauteuils prend trois rendez-vous en parallèle.
   * Sans équipe déclarée, on suppose une personne.
   *
   * On désactive avant de réactiver plutôt que de supprimer : une personne qui
   * quitte le salon a des rendez-vous passés attachés à son nom, et les
   * effacer emporterait l'historique avec elle.
   */
  const team =
    site.team.length > 0 ? site.team.map((m) => m.name) : [site.business.name];

  await sql`update resources set active = false where tenant_id = ${tenantId}`;
  for (const name of team) {
    await sql`
      insert into resources (tenant_id, name, active)
      values (${tenantId}, ${name}, true)
      on conflict (tenant_id, name) do update set active = true
    `;
  }

  return {
    tenantId,
    services: site.services.length,
    resources: team.length,
    notifyEmail,
    origin,
  };
}
