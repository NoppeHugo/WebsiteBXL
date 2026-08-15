import type { FastifyInstance, FastifyRequest } from "fastify";
import { WEEKDAYS, type Weekday } from "@bxl/schema";
import { clients, client, readSiteRaw, writeSite, commitAndPush, publish, pull } from "../repo.ts";
import { logPublish } from "../db.ts";
import { layout, flash, escape } from "../views.ts";
import { parseSlots, formatSlots } from "../hours.ts";

/*
 * Édition du contenu.
 *
 * Le formulaire structuré ne touche que ce qui change souvent et n'est pas
 * traduit : statut, coordonnées, horaires, tarifs et durées. Les libellés
 * traduits ne sont modifiables que par l'éditeur JSON — un champ simplifié qui
 * écraserait les versions néerlandaise et anglaise ferait perdre du travail
 * facturé, silencieusement.
 */

function adminId(request: FastifyRequest): number {
  return (request as FastifyRequest & { adminId: number }).adminId;
}

function editPage(slug: string, message?: { kind: "ok" | "error"; text: string }): string {
  const loaded = client(slug);
  const site = loaded.site;

  const hoursFields = WEEKDAYS.map(
    (day) => `<label>${day}
      <input type="text" name="hours.${day}" value="${escape(formatSlots(site.hours[day]))}"
             placeholder="09:00-18:00 (vide = fermé)">
    </label>`,
  ).join("");

  const serviceRows = site.services
    .map(
      (service, index) => `<tr>
      <td>${escape(service.name[site.languages.default] ?? service.id)}
        <div class="muted">${escape(service.id)}</div></td>
      <td><input type="number" name="services.${index}.durationMin" value="${service.durationMin}" min="5" max="600" step="5"></td>
      <td><input type="number" name="services.${index}.price" value="${service.price ?? ""}" min="0" step="1" placeholder="sur devis"></td>
    </tr>`,
    )
    .join("");

  return layout(
    site.business.name,
    `<h1>${escape(site.business.name)}</h1>
<p class="muted">${escape(site.domain)} · palier ${escape(site.plan)} ·
   <span class="badge" data-status="${escape(site.status)}">${escape(site.status)}</span></p>

${message ? flash(message.kind, message.text) : ""}

<form method="post" action="/clients/${escape(slug)}">
  <fieldset>
    <legend>Publication</legend>
    <div class="row">
      <label>Statut
        <select name="status">
          ${["draft", "live", "suspended"]
            .map(
              (s) =>
                `<option value="${s}"${s === site.status ? " selected" : ""}>${s}</option>`,
            )
            .join("")}
        </select>
      </label>
    </div>
    <p class="muted">« suspended » remplace le site par une page d'indisponibilité, sans le supprimer.</p>
  </fieldset>

  <fieldset>
    <legend>Coordonnées</legend>
    <div class="row">
      <label>Téléphone<input type="text" name="phone" value="${escape(site.business.phone)}"></label>
      <label>E-mail<input type="email" name="email" value="${escape(site.business.email ?? "")}"></label>
    </div>
  </fieldset>

  <fieldset>
    <legend>Horaires</legend>
    <div class="row">${hoursFields}</div>
  </fieldset>

  ${
    site.services.length > 0
      ? `<fieldset>
    <legend>Tarifs et durées</legend>
    <table>
      <thead><tr><th>Prestation</th><th>Durée (min)</th><th>Prix (€)</th></tr></thead>
      <tbody>${serviceRows}</tbody>
    </table>
    <p class="muted">Les libellés traduits se modifient dans l'éditeur JSON ci-dessous.</p>
  </fieldset>`
      : ""
  }

  <div class="actions">
    <button type="submit">Enregistrer</button>
  </div>
</form>

<form method="post" action="/clients/${escape(slug)}/publish">
  <div class="actions">
    <button type="submit" class="secondary">Publier en ligne</button>
  </div>
  <p class="muted">Construit le site et le déploie. Refusé si le statut n'est pas « live ».</p>
</form>

<h2>Édition avancée</h2>
<form method="post" action="/clients/${escape(slug)}/json">
  <label>site.json
    <textarea name="json" rows="24" spellcheck="false">${escape(
      JSON.stringify(readSiteRaw(slug), null, 2),
    )}</textarea>
  </label>
  <div class="actions"><button type="submit" class="secondary">Enregistrer le JSON</button></div>
</form>

<p style="margin-top:2rem"><a href="/">← Tous les clients</a></p>`,
    { authenticated: true },
  );
}

export function clientRoutes(app: FastifyInstance): void {
  app.get("/", async (_request, reply) => {
    const rows = clients()
      .map((slug) => {
        try {
          const { site } = client(slug);
          return `<tr>
            <td><a href="/clients/${escape(slug)}">${escape(site.business.name)}</a>
              <div class="muted">${escape(slug)}</div></td>
            <td>${escape(site.domain)}</td>
            <td>${escape(site.plan)}</td>
            <td><span class="badge" data-status="${escape(site.status)}">${escape(site.status)}</span></td>
          </tr>`;
        } catch (error) {
          // Un client au fichier invalide doit rester visible : c'est
          // justement celui qu'il faut aller réparer.
          return `<tr><td>${escape(slug)}</td><td colspan="3" class="muted">illisible : ${escape(
            error instanceof Error ? error.message.split("\n")[0] : error,
          )}</td></tr>`;
        }
      })
      .join("");

    return reply.type("text/html").send(
      layout(
        "Clients",
        `<h1>Clients</h1>
<table>
  <thead><tr><th>Commerce</th><th>Domaine</th><th>Palier</th><th>Statut</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`,
        { authenticated: true },
      ),
    );
  });

  app.get<{ Params: { slug: string } }>("/clients/:slug", async (request, reply) => {
    // On récupère l'état du dépôt avant d'afficher : éditer une version
    // périmée produirait un conflit au moment de pousser.
    await pull();
    return reply.type("text/html").send(editPage(request.params.slug));
  });

  app.post<{ Params: { slug: string }; Body: Record<string, string> }>(
    "/clients/:slug",
    async (request, reply) => {
      const { slug } = request.params;
      const body = request.body ?? {};
      const raw = readSiteRaw(slug);

      raw.status = body.status;
      const business = raw.business as Record<string, unknown>;
      business.phone = body.phone;
      if (body.email) business.email = body.email;
      else delete business.email;

      const hours: Record<string, unknown> = {};
      for (const day of WEEKDAYS) {
        hours[day] = parseSlots(body[`hours.${day}`] ?? "");
      }
      raw.hours = hours;

      const services = (raw.services as Array<Record<string, unknown>>) ?? [];
      services.forEach((service, index) => {
        const duration = body[`services.${index}.durationMin`];
        const price = body[`services.${index}.price`];
        if (duration) service.durationMin = Number(duration);
        service.price = price === "" || price === undefined ? null : Number(price);
      });

      const written = writeSite(slug, raw);
      if (!written.ok) {
        return reply
          .code(400)
          .type("text/html")
          .send(editPage(slug, { kind: "error", text: written.errors.join(" · ") }));
      }

      const pushed = await commitAndPush(slug, `contenu(${slug}) : mise à jour depuis la console`);
      await logPublish(adminId(request), slug, "save", pushed.output.slice(0, 500));

      return reply.type("text/html").send(
        editPage(slug, {
          kind: pushed.ok ? "ok" : "error",
          text: pushed.ok
            ? "Enregistré et poussé. Utilisez « Publier en ligne » pour mettre à jour le site."
            : `Enregistré localement, mais git a échoué : ${pushed.output.slice(0, 300)}`,
        }),
      );
    },
  );

  app.post<{ Params: { slug: string }; Body: { json?: string } }>(
    "/clients/:slug/json",
    async (request, reply) => {
      const { slug } = request.params;

      let parsed: unknown;
      try {
        parsed = JSON.parse(request.body?.json ?? "");
      } catch (error) {
        return reply.code(400).type("text/html").send(
          editPage(slug, {
            kind: "error",
            text: `JSON invalide : ${(error as Error).message}`,
          }),
        );
      }

      const written = writeSite(slug, parsed);
      if (!written.ok) {
        return reply
          .code(400)
          .type("text/html")
          .send(editPage(slug, { kind: "error", text: written.errors.join(" · ") }));
      }

      const pushed = await commitAndPush(slug, `contenu(${slug}) : édition JSON depuis la console`);
      await logPublish(adminId(request), slug, "save", "json");

      return reply.type("text/html").send(
        editPage(slug, {
          kind: pushed.ok ? "ok" : "error",
          text: pushed.ok ? "JSON enregistré et poussé." : pushed.output.slice(0, 300),
        }),
      );
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/clients/:slug/publish",
    async (request, reply) => {
      const { slug } = request.params;
      const result = await publish(slug);
      await logPublish(adminId(request), slug, "publish", result.output.slice(0, 1000));

      return reply.type("text/html").send(
        editPage(slug, {
          kind: result.ok ? "ok" : "error",
          text: result.ok
            ? "Site publié."
            : result.output.slice(-600) || "échec du déploiement",
        }),
      );
    },
  );
}
