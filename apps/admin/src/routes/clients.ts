import { createReadStream } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { WEEKDAYS, type Weekday } from "@bxl/schema";
import { clients, client, readSiteRaw, writeSite, commitAndPush, publish, pull } from "../repo.ts";
import { config } from "../config.ts";
import { logPublish } from "../db.ts";
import { layout, flash, escape } from "../views.ts";
import { parseSlots, formatSlots } from "../hours.ts";
import {
  listMedia,
  mediaPath,
  saveMedia,
  deleteMedia,
  MAX_UPLOAD_BYTES,
} from "../media.ts";

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
  const photos = listMedia(config.REPO_PATH, slug);

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

<h2>Photos</h2>
<p class="muted">
  ${escape(String(photos.length))} fichier(s). Les images sont réduites et
  converties à l'envoi : inutile de les préparer avant.
</p>

${
  photos.length > 0
    ? `<div class="media-grid">${photos
        .map(
          (photo) => `<figure class="media">
      <img src="/clients/${escape(slug)}/media/${escape(photo.name)}" alt="" loading="lazy">
      <figcaption>
        <span>${escape(photo.name)}</span>
        <span class="muted">${Math.round(photo.bytes / 1024)} ko</span>
      </figcaption>
      <form method="post" action="/clients/${escape(slug)}/media/${escape(photo.name)}/delete"
            onsubmit="return confirm('Supprimer ${escape(photo.name)} ?')">
        <button class="danger">Supprimer</button>
      </form>
    </figure>`,
        )
        .join("")}</div>`
    : ""
}

<form method="post" action="/clients/${escape(slug)}/media" enctype="multipart/form-data">
  <label>Ajouter des photos
    <input type="file" name="photos" accept="image/*" multiple required>
  </label>
  <div class="actions"><button type="submit">Envoyer</button></div>
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
  /*
   * Aperçu d'une photo. Le nom passe par `mediaPath`, qui refuse tout ce qui
   * n'est pas un nom de fichier simple : sans ce contrôle, un nom fabriqué
   * ferait lire n'importe quel fichier du serveur.
   */
  app.get<{ Params: { slug: string; name: string } }>(
    "/clients/:slug/media/:name",
    async (request, reply) => {
      const path = mediaPath(config.REPO_PATH, request.params.slug, request.params.name);
      if (!path) return reply.code(404).send("introuvable");
      return reply.type("image/jpeg").send(createReadStream(path));
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/clients/:slug/media",
    async (request, reply) => {
      const { slug } = request.params;
      const saved: string[] = [];
      const errors: string[] = [];

      for await (const part of request.files({
        limits: { fileSize: MAX_UPLOAD_BYTES, files: 30 },
      })) {
        const buffer = await part.toBuffer();
        const result = await saveMedia(config.REPO_PATH, slug, part.filename, buffer);
        if (result.ok && result.name) saved.push(result.name);
        else errors.push(`${part.filename} : ${result.error}`);
      }

      if (saved.length > 0) {
        const pushed = await commitAndPush(
          slug,
          `photos(${slug}) : ${saved.length} fichier(s) ajouté(s)`,
        );
        await logPublish(adminId(request), slug, "save", `photos: ${saved.join(", ")}`);
        if (!pushed.ok) errors.push(`git : ${pushed.output.slice(0, 200)}`);
      }

      return reply.type("text/html").send(
        editPage(slug, {
          kind: errors.length > 0 ? "error" : "ok",
          text:
            errors.length > 0
              ? errors.join(" · ")
              : `${saved.length} photo(s) ajoutée(s). Publiez pour les mettre en ligne.`,
        }),
      );
    },
  );

  app.post<{ Params: { slug: string; name: string } }>(
    "/clients/:slug/media/:name/delete",
    async (request, reply) => {
      const { slug, name } = request.params;

      /*
       * Une photo référencée par site.json ne peut pas être supprimée : le
       * build échouerait, et le refus est plus utile qu'un site cassé.
       */
      const site = client(slug).site;
      const used = [
        site.hero.image,
        ...site.gallery.map((p) => p.src),
        ...site.team.map((m) => m.photo).filter(Boolean),
      ];
      if (used.includes(name)) {
        return reply.code(400).type("text/html").send(
          editPage(slug, {
            kind: "error",
            text: `${name} est utilisée par le site. Retirez-la d'abord du contenu.`,
          }),
        );
      }

      const removed = deleteMedia(config.REPO_PATH, slug, name);
      if (removed) {
        await commitAndPush(slug, `photos(${slug}) : ${name} supprimée`);
        await logPublish(adminId(request), slug, "save", `suppression: ${name}`);
      }

      return reply.type("text/html").send(
        editPage(slug, {
          kind: removed ? "ok" : "error",
          text: removed ? `${name} supprimée.` : "fichier introuvable",
        }),
      );
    },
  );
}
