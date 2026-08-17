import type { SiteConfig } from "@bxl/schema";
import { syncTenant } from "@bxl/api/tenant-sync";
import { sql } from "./db.ts";

/**
 * Reporte en base ce que la console vient d'enregistrer dans git.
 *
 * Git reste la source de vérité ; la base n'en détient qu'une copie, dont
 * l'agenda et les formulaires ont besoin à chaque requête. Le détail est dans
 * `@bxl/api/tenant-sync`.
 *
 * À appeler après **chaque** écriture de contenu, et non seulement à la
 * création. Sans cela, un horaire modifié dans l'éditeur s'affichait bien sur
 * le site mais la réservation continuait de proposer les anciens créneaux :
 * le site annonçait « fermé le lundi » pendant que l'agenda acceptait le
 * lundi. Rien ne le signalait — c'est le client du salon qui l'aurait
 * découvert, devant une porte close.
 *
 * Silencieuse quand le commerce n'a pas de `tenantId` : un site vitrine sans
 * formulaire n'a rien à projeter, et ce n'est pas une anomalie.
 */
export async function projeterCommerce(
  site: SiteConfig,
): Promise<{ ok: boolean; message: string }> {
  if (!site.tenantId) {
    return { ok: true, message: "commerce sans tenantId : rien à reporter en base" };
  }

  const destinataire = site.business.email;
  if (!destinataire) {
    return {
      ok: false,
      message:
        "aucune adresse e-mail pour le commerce : les demandes de contact et" +
        " les avis de rendez-vous n'auraient nulle part où aller.",
    };
  }

  try {
    const resultat = await syncTenant(sql, site, {
      tenantId: site.tenantId,
      notifyEmail: destinataire,
    });
    return {
      ok: true,
      message: `base à jour : ${resultat.services} prestation(s), ${resultat.resources} personne(s)`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `report en base impossible : ${(error as Error).message}`,
    };
  }
}
