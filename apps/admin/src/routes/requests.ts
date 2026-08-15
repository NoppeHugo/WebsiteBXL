import type { FastifyInstance } from "fastify";
import { recentBookings, setBookingStatus } from "../db.ts";
import { layout, escape } from "../views.ts";

const PERIOD: Record<string, string> = {
  morning: "matin",
  afternoon: "après-midi",
  evening: "soirée",
};

/**
 * Suivi des demandes de rendez-vous.
 *
 * En v1 le salon confirme par courriel ; cette page sert à voir d'un coup
 * d'œil ce qui est arrivé et à marquer ce qui a été traité — sans quoi une
 * demande passée entre les mailles ne se remarque jamais.
 */
export function requestRoutes(app: FastifyInstance): void {
  app.get("/requests", async (_request, reply) => {
    const rows = await recentBookings();

    const table = rows
      .map(
        (row) => `<tr>
      <td>
        <strong>${escape(row.customer_name)}</strong>
        <div class="muted">${escape(row.customer_email)}${
          row.customer_phone ? ` · ${escape(row.customer_phone)}` : ""
        }</div>
        ${row.note ? `<div class="muted">« ${escape(row.note)} »</div>` : ""}
      </td>
      <td>${escape(row.business_name)}</td>
      <td>${escape(row.service_name)}</td>
      <td>${escape(String(row.preferred_date).slice(0, 10))}<div class="muted">${escape(
        PERIOD[row.preferred_period] ?? row.preferred_period,
      )}</div></td>
      <td><span class="badge" data-status="${escape(row.status)}">${escape(row.status)}</span></td>
      <td>
        <form method="post" action="/requests/${escape(row.id)}/status" style="display:flex;gap:0.4rem">
          <select name="status" style="width:auto">
            ${["new", "confirmed", "declined", "cancelled"]
              .map(
                (s) =>
                  `<option value="${s}"${s === row.status ? " selected" : ""}>${s}</option>`,
              )
              .join("")}
          </select>
          <button class="secondary" style="padding:0.4em 1em;font-size:0.85rem">OK</button>
        </form>
      </td>
    </tr>`,
      )
      .join("");

    return reply.type("text/html").send(
      layout(
        "Demandes",
        `<h1>Demandes de rendez-vous</h1>
${
  rows.length === 0
    ? `<p class="muted">Aucune demande pour l'instant.</p>`
    : `<table>
  <thead><tr><th>Client</th><th>Commerce</th><th>Prestation</th><th>Souhaité</th><th>Statut</th><th></th></tr></thead>
  <tbody>${table}</tbody>
</table>`
}`,
        { authenticated: true },
      ),
    );
  });

  app.post<{ Params: { id: string }; Body: { status?: string } }>(
    "/requests/:id/status",
    async (request, reply) => {
      const status = request.body?.status;
      if (
        status === "new" ||
        status === "confirmed" ||
        status === "declined" ||
        status === "cancelled"
      ) {
        await setBookingStatus(request.params.id, status);
      }
      return reply.redirect("/requests", 303);
    },
  );
}
