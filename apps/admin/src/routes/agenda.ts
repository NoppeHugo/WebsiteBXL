import type { FastifyInstance } from "fastify";
import { cancelledByBusiness } from "@bxl/api/appointment-notices";
import { sql } from "../db.ts";
import { clients, client } from "../repo.ts";
import { sendMail } from "../mail.ts";
import { layout, escape } from "../views.ts";

/**
 * Agenda du jour.
 *
 * Le salon gère ses rendez-vous depuis son propre écran ; cette page sert à
 * répondre quand il appelle — « vous avez qui à 14 h ? » — et à repérer les
 * absences répétées. Une journée à la fois : c'est la question qu'on se pose,
 * pas un planning mensuel.
 */
interface Row {
  id: string;
  starts: string;
  ends: string;
  resource: string;
  service_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  note: string | null;
  status: string;
}

const STATUS = {
  booked: "réservé",
  honoured: "venu",
  no_show: "absent",
  cancelled: "annulé",
} as const;

export function agendaRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { slug?: string; day?: string } }>(
    "/agenda",
    async (request, reply) => {
      const bookable = clients()
        .map((slug) => {
          try {
            const { site } = client(slug);
            return site.tenantId && site.booking.mode === "live"
              ? { slug, site }
              : undefined;
          } catch {
            return undefined;
          }
        })
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      const slug = request.query.slug ?? bookable[0]?.slug;
      const selected = bookable.find((c) => c.slug === slug);
      const day = request.query.day ?? new Date().toISOString().slice(0, 10);

      if (!selected) {
        return reply.type("text/html").send(
          layout(
            "Agenda",
            `<h1>Agenda</h1>
<p class="muted">Aucun client en agenda temps réel. Passez
<code>booking.mode</code> à <code>live</code> puis relancez
<code>pnpm tenant &lt;slug&gt;</code>.</p>`,
            { authenticated: true },
          ),
        );
      }

      const rows = await sql<Row[]>`
        select a.id, lower(a.during) as starts, upper(a.during) as ends,
               r.name as resource, a.service_name, a.customer_name,
               a.customer_email, a.customer_phone, a.note, a.status
        from appointments a
        join resources r on r.id = a.resource_id
        where a.tenant_id = ${selected.site.tenantId!}
          and a.during && tstzrange(${`${day} 00:00:00+00`}::timestamptz - interval '1 day',
                                    ${`${day} 00:00:00+00`}::timestamptz + interval '2 days')
        order by lower(a.during), r.name
      `;

      const time = new Intl.DateTimeFormat("fr-BE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Brussels",
      });

      // Le filtre en base est large d'un jour de chaque côté pour couvrir le
      // décalage horaire ; on resserre ici sur la journée belge réelle.
      const onDay = rows.filter(
        (r) =>
          new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Brussels" }).format(
            new Date(r.starts),
          ) === day,
      );

      const table = onDay
        .map(
          (row) => `<tr>
        <td><strong>${escape(time.format(new Date(row.starts)))}</strong>
          <div class="muted">${escape(time.format(new Date(row.ends)))}</div></td>
        <td>${escape(row.resource)}</td>
        <td>${escape(row.service_name)}</td>
        <td>${escape(row.customer_name)}
          <div class="muted">${escape(row.customer_email)}${
            row.customer_phone ? ` · ${escape(row.customer_phone)}` : ""
          }</div>
          ${row.note ? `<div class="muted">« ${escape(row.note)} »</div>` : ""}</td>
        <td><span class="badge">${escape(STATUS[row.status as keyof typeof STATUS] ?? row.status)}</span></td>
        <td>
          <form method="post" action="/agenda/${escape(row.id)}/status" style="display:flex;gap:0.4rem">
            <input type="hidden" name="slug" value="${escape(slug!)}">
            <input type="hidden" name="day" value="${escape(day)}">
            <select name="status" style="width:auto">
              ${Object.entries(STATUS)
                .map(
                  ([value, label]) =>
                    `<option value="${value}"${value === row.status ? " selected" : ""}>${label}</option>`,
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
          "Agenda",
          `<h1>Agenda</h1>

<form method="get" action="/agenda" class="filters">
  <label>Commerce
    <select name="slug" onchange="this.form.submit()">
      ${bookable
        .map(
          (c) =>
            `<option value="${escape(c.slug)}"${c.slug === slug ? " selected" : ""}>${escape(c.site.business.name)}</option>`,
        )
        .join("")}
    </select>
  </label>
  <label>Jour
    <input type="date" name="day" value="${escape(day)}" onchange="this.form.submit()">
  </label>
</form>

${
  onDay.length === 0
    ? `<p class="muted">Aucun rendez-vous ce jour-là.</p>`
    : `<table>
  <thead><tr><th>Heure</th><th>Avec</th><th>Prestation</th><th>Client</th><th>État</th><th></th></tr></thead>
  <tbody>${table}</tbody>
</table>`
}`,
          { authenticated: true },
        ),
      );
    },
  );

  app.post<{ Params: { id: string }; Body: { status?: string; slug?: string; day?: string } }>(
    "/agenda/:id/status",
    async (request, reply) => {
      const { status, slug, day } = request.body ?? {};

      if (status && status in STATUS) {
        /*
         * L'état précédent est lu avant l'écriture : c'est lui qui dit s'il
         * s'agit d'une véritable annulation ou d'un simple renvoi du même
         * formulaire. Prévenir deux fois le client de la même annulation
         * ferait douter de la première.
         */
        const [before] = await sql<Array<{ status: string }>>`
          select status from appointments where id = ${request.params.id}
        `;

        await sql`
          update appointments set status = ${status} where id = ${request.params.id}
        `;

        if (status === "cancelled" && before && before.status !== "cancelled") {
          await notifyCancellation(request.params.id, slug).catch((error) =>
            request.log.error(
              { err: error, appointmentId: request.params.id },
              "annulation non transmise au client",
            ),
          );
        }
      }

      const query = new URLSearchParams();
      if (slug) query.set("slug", slug);
      if (day) query.set("day", day);
      return reply.redirect(`/agenda?${query.toString()}`, 303);
    },
  );
}

/**
 * Prévient le client qu'un rendez-vous vient d'être annulé par le salon.
 *
 * Sans ce courriel, une annulation prise au téléphone laisse le client se
 * présenter devant une porte fermée — et c'est le commerce qui en porte
 * l'image, sur l'outil qu'on lui a vendu.
 */
async function notifyCancellation(id: string, slug?: string): Promise<void> {
  const [row] = await sql<
    Array<{
      customer_name: string;
      customer_email: string;
      service_name: string;
      starts: string;
      locale: string;
      tenant_id: string;
    }>
  >`
    select a.customer_name, a.customer_email, a.service_name,
           lower(a.during) as starts, a.locale, a.tenant_id
    from appointments a
    where a.id = ${id}
  `;
  if (!row) return;

  /*
   * Le formulaire fournit le slug, mais le rendez-vous suffit à le retrouver.
   * Dépendre du seul champ caché ferait dépendre l'information du client du
   * bon vouloir d'un formulaire — une annulation muette est exactement ce que
   * ce courriel existe pour éviter.
   */
  const resolved =
    slug ??
    clients().find((candidate) => {
      try {
        return client(candidate).site.tenantId === row.tenant_id;
      } catch {
        return false;
      }
    });
  if (!resolved) throw new Error(`aucun client pour le commerce ${row.tenant_id}`);

  const { site } = client(resolved);

  const when = new Intl.DateTimeFormat(`${row.locale}-BE`, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  }).format(new Date(row.starts));

  await sendMail(
    cancelledByBusiness({
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      businessName: site.business.name,
      businessPhone: site.business.phone,
      serviceName: row.service_name,
      when,
      locale: row.locale,
    }),
  );
}
