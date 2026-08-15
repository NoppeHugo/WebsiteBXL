import type { FastifyInstance } from "fastify";
import { monthlySummary, reportText } from "@bxl/api/analytics";
import { sql } from "../db.ts";
import { clients, client } from "../repo.ts";
import { layout, escape } from "../views.ts";

/**
 * Rapport d'audience mensuel.
 *
 * L'objectif n'est pas de contempler des courbes : c'est de produire un texte
 * prêt à envoyer au commerçant. Le churn est le risque principal du modèle, et
 * un client qui reçoit chaque mois la preuve chiffrée de ce qu'il paie résilie
 * beaucoup moins.
 */

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${MONTHS[Number(m) - 1]} ${year}`;
}

/** Les douze derniers mois, du plus récent au plus ancien. */
function recentMonths(today = new Date()): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

export function reportRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { slug?: string; month?: string } }>(
    "/reports",
    async (request, reply) => {
      const months = recentMonths();
      const month = request.query.month ?? months[0]!;

      // Seuls les clients enregistrés auprès de l'API ont des données.
      const measurable = clients()
        .map((slug) => {
          try {
            const { site } = client(slug);
            return site.tenantId ? { slug, site } : undefined;
          } catch {
            return undefined;
          }
        })
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      const slug = request.query.slug ?? measurable[0]?.slug;
      const selected = measurable.find((c) => c.slug === slug);

      if (!selected) {
        return reply.type("text/html").send(
          layout(
            "Rapports",
            `<h1>Rapports d'audience</h1>
<p class="muted">Aucun client n'est encore enregistré auprès de l'API.
Lancez <code>pnpm tenant &lt;slug&gt;</code> pour en activer un.</p>`,
            { authenticated: true },
          ),
        );
      }

      const summary = await monthlySummary(sql, selected.site.tenantId!, month);
      const text = reportText(
        selected.site.business.name,
        monthLabel(month),
        summary,
      );

      const tiles = [
        ["Visiteurs", summary.visitors],
        ["Pages vues", summary.views],
        ["Appels", summary.calls],
        ["Itinéraires", summary.directions],
        ["Rendez-vous", summary.bookings],
        ["Messages", summary.contacts],
        ["Sur téléphone", `${summary.mobileShare} %`],
      ]
        .map(
          ([label, value]) =>
            `<div class="tile"><b>${escape(value)}</b><span>${escape(label)}</span></div>`,
        )
        .join("");

      return reply.type("text/html").send(
        layout(
          "Rapports",
          `<h1>Rapports d'audience</h1>

<form method="get" action="/reports" class="filters">
  <label>Commerce
    <select name="slug" onchange="this.form.submit()">
      ${measurable
        .map(
          (c) =>
            `<option value="${escape(c.slug)}"${c.slug === slug ? " selected" : ""}>${escape(
              c.site.business.name,
            )}</option>`,
        )
        .join("")}
    </select>
  </label>
  <label>Mois
    <select name="month" onchange="this.form.submit()">
      ${months
        .map(
          (m) =>
            `<option value="${m}"${m === month ? " selected" : ""}>${escape(
              monthLabel(m),
            )}</option>`,
        )
        .join("")}
    </select>
  </label>
</form>

<div class="tiles">${tiles}</div>

${
  summary.topReferrers.length > 0
    ? `<h2>D'où viennent les visiteurs</h2>
<table>
  <thead><tr><th>Provenance</th><th>Visites</th></tr></thead>
  <tbody>${summary.topReferrers
    .map(
      (r) =>
        `<tr><td>${escape(r.referrer)}</td><td>${escape(String(r.count))}</td></tr>`,
    )
    .join("")}</tbody>
</table>`
    : ""
}

<h2>Message à envoyer</h2>
<p class="muted">Copiez-collez tel quel dans un courriel au commerçant.</p>
<textarea rows="14" readonly id="report-text">${escape(text)}</textarea>
<div class="actions">
  <button type="button" onclick="
    var t = document.getElementById('report-text');
    t.select();
    navigator.clipboard.writeText(t.value).then(function () {
      var b = event.target; var old = b.textContent;
      b.textContent = 'Copié'; setTimeout(function(){ b.textContent = old; }, 1500);
    });
  ">Copier le message</button>
</div>`,
          { authenticated: true },
        ),
      );
    },
  );
}
