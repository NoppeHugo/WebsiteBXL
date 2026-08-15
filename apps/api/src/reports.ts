import type { Sql } from "postgres";
import { monthlySummary, reportText } from "./analytics.ts";
import type { Mail } from "./mail.ts";

/**
 * Envoi automatique du rapport mensuel.
 *
 * C'est la principale défense contre la résiliation : un commerçant qui reçoit
 * chaque mois la preuve chiffrée de ce que son site lui rapporte ne se demande
 * pas à quoi sert son abonnement. Automatisé plutôt que manuel, précisément
 * parce qu'un envoi manuel finit par sauter les mois chargés — ceux où l'on
 * prospecte, donc ceux où le churn coûte le plus cher.
 *
 * L'envoi est reçu en argument plutôt qu'importé : le module reste testable
 * sans configuration de serveur ni courriel réellement expédié. C'est la même
 * règle que pour la base de données — un module métier ne doit rien savoir de
 * la configuration du service qui l'héberge.
 */

const MONTHS: Record<string, string[]> = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
       "août", "septembre", "octobre", "novembre", "décembre"],
  nl: ["januari", "februari", "maart", "april", "mei", "juni", "juli",
       "augustus", "september", "oktober", "november", "december"],
  en: ["January", "February", "March", "April", "May", "June", "July",
       "August", "September", "October", "November", "December"],
};

export function monthLabel(month: string, locale = "fr"): string {
  const [year, m] = month.split("-");
  // Repli sur le français plutôt que sur le numéro du mois : ce texte part
  // chez un commerçant, « 07 2026 » s'y verrait immédiatement.
  const names = MONTHS[locale] ?? MONTHS.fr!;
  return `${names[Number(m) - 1] ?? m} ${year}`;
}

/** Mois précédent au format YYYY-MM. */
export function previousMonth(today = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

const SUBJECT: Record<string, (business: string, month: string) => string> = {
  fr: (b, m) => `${b} — votre site en ${m}`,
  nl: (b, m) => `${b} — uw site in ${m}`,
  en: (b, m) => `${b} — your site in ${m}`,
};

interface ReportTenant {
  id: string;
  slug: string;
  business_name: string;
  notify_email: string;
  locale: string;
}

/**
 * Envoie le rapport du mois écoulé aux commerçants qui ne l'ont pas encore
 * reçu. Idempotent : la trace en base empêche un second envoi, y compris
 * après un redémarrage du service.
 *
 * `force` réémet un mois déjà envoyé — utilisé par le bouton de l'interface
 * d'administration.
 */
export async function sendMonthlyReports(
  sql: Sql,
  send: (mail: Mail) => Promise<void>,
  options: { month?: string; tenantId?: string; force?: boolean; today?: Date } = {},
): Promise<{ sent: string[]; skipped: string[]; failed: string[] }> {
  const month = options.month ?? previousMonth(options.today);

  const tenants = await sql<ReportTenant[]>`
    select t.id, t.slug, t.business_name, t.notify_email, t.locale
    from tenants t
    where t.report_enabled
      ${options.tenantId ? sql`and t.id = ${options.tenantId}` : sql``}
      ${
        options.force
          ? sql``
          : sql`and not exists (
              select 1 from monthly_reports r
              where r.tenant_id = t.id and r.month = ${month}
            )`
      }
    order by t.slug
  `;

  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const tenant of tenants) {
    const summary = await monthlySummary(sql, tenant.id, month);

    // Un mois sans la moindre visite ne vaut pas un courriel : envoyer
    // « 0 visiteur » à un commerçant qui paie chaque mois est le meilleur
    // moyen de lui donner envie de résilier.
    if (summary.views === 0) {
      skipped.push(tenant.slug);
      continue;
    }

    const label = monthLabel(month, tenant.locale);

    try {
      await send({
        to: tenant.notify_email,
        subject: (SUBJECT[tenant.locale] ?? SUBJECT.fr!)(tenant.business_name, label),
        text: reportText(tenant.business_name, label, summary),
      });

      await sql`
        insert into monthly_reports (tenant_id, month)
        values (${tenant.id}, ${month})
        on conflict (tenant_id, month) do update set sent_at = now()
      `;
      sent.push(tenant.slug);
    } catch {
      // Un échec ne bloque pas les suivants, et la trace n'est pas écrite :
      // la prochaine tentative reprendra ce commerce.
      failed.push(tenant.slug);
    }
  }

  return { sent, skipped, failed };
}

/**
 * Faut-il tenter l'envoi aujourd'hui ?
 *
 * À partir du 2 du mois : le 1er, les événements de la veille peuvent encore
 * arriver, et un rapport amputé de son dernier jour se remarque.
 */
export function shouldRunToday(today = new Date()): boolean {
  return today.getUTCDate() >= 2;
}
