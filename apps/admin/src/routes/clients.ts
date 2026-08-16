import { createReadStream } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { WEEKDAYS, type Weekday } from "@bxl/schema";
import { clients, client, readSiteRaw, writeSite, commitAndPush, publish, pull } from "../repo.ts";
import { config } from "../config.ts";
import { logPublish, etatPublication } from "../db.ts";
import { layout, flash, escape, STATUTS, statutLisible, depuis } from "../views.ts";
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

/**
 * Où chaque photo est utilisée dans le site.
 *
 * Même source que le refus de suppression plus bas : dire à l'écran ce que le
 * serveur refusera de toute façon évite de découvrir l'interdiction en la
 * heurtant.
 */
function usagesPhotos(site: ReturnType<typeof client>["site"]): Map<string, string> {
  const usages = new Map<string, string>();
  if (site.hero.image) usages.set(site.hero.image, "Photo d'accueil");
  site.gallery.forEach((photo, index) => usages.set(photo.src, `Galerie ${index + 1}`));
  site.team.forEach((membre) => {
    if (membre.photo) usages.set(membre.photo, `Équipe — ${membre.name}`);
  });
  return usages;
}

async function editPage(
  slug: string,
  message?: { kind: "ok" | "error"; text: string },
): Promise<string> {
  const loaded = client(slug);
  const site = loaded.site;
  const photos = listMedia(config.REPO_PATH, slug);
  const usages = usagesPhotos(site);
  const etat = await etatPublication(slug);

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

  /*
   * Le bandeau d'état répond, avant toute chose, à « ce que je vois est-il en
   * ligne ? ». Deux boutons nommés « Enregistrer » et « Publier en ligne » se
   * ressemblent trop pour que la distinction se devine : on enregistre, on lit
   * « enregistré », et le site continue d'afficher l'ancien horaire.
   */
  const bandeau =
    site.status !== "live"
      ? `<div class="etat" data-etat="brouillon">
    <div class="etat__texte">
      <b>${escape(statutLisible(site.status))}</b>
      <span>${escape(STATUTS[site.status as keyof typeof STATUTS]?.aide ?? "")}</span>
    </div>
  </div>`
      : etat.enAttente
        ? `<div class="etat" data-etat="attente">
    <div class="etat__texte">
      <b>Modifications non publiées</b>
      <span>Enregistré ${escape(depuis(etat.derniereModification))} ·
        dernière mise en ligne ${escape(depuis(etat.derniereMiseEnLigne))}.
        Le site public affiche encore la version précédente.</span>
    </div>
    <form method="post" action="/clients/${escape(slug)}/publish">
      <button type="submit">Mettre en ligne</button>
    </form>
  </div>`
        : `<div class="etat" data-etat="enligne">
    <div class="etat__texte">
      <b>En ligne et à jour</b>
      <span>Dernière mise en ligne ${escape(depuis(etat.derniereMiseEnLigne))}.</span>
    </div>
    <a class="lien-site" href="https://${escape(site.domain)}" target="_blank" rel="noopener">
      Voir le site ↗
    </a>
  </div>`;

  return layout(
    site.business.name,
    `<h1>${escape(site.business.name)}</h1>
<p class="intro">
  ${escape(site.domain)} · palier ${escape(site.plan)} ·
  <a href="https://${escape(site.domain)}" target="_blank" rel="noopener">voir le site ↗</a>
</p>

${message ? flash(message.kind, message.text) : ""}
${bandeau}

<p class="raccourci">
  <a class="btn-lien" href="/clients/${escape(slug)}/contenu">Modifier le contenu du site →</a>
  <span class="aide">Textes, photos, galerie, équipe, avis — sans toucher au fichier.</span>
</p>

<form method="post" action="/clients/${escape(slug)}">
  <fieldset>
    <legend>Visibilité</legend>
    <div class="row">
      <label>État du site
        <select name="status">
          ${(["draft", "live", "suspended"] as const)
            .map(
              (s) =>
                `<option value="${s}"${s === site.status ? " selected" : ""}>${STATUTS[s].nom}</option>`,
            )
            .join("")}
        </select>
      </label>
    </div>
    <p class="aide">
      ${(["draft", "live", "suspended"] as const)
        .map((s) => `<b>${STATUTS[s].nom}</b> — ${STATUTS[s].aide}`)
        .join("<br>")}
    </p>
  </fieldset>

  <fieldset>
    <legend>Coordonnées</legend>
    <div class="row">
      <label>Téléphone<input type="text" name="phone" value="${escape(site.business.phone)}"></label>
      <label>E-mail<input type="email" name="email" value="${escape(site.business.email ?? "")}"></label>
    </div>
    <p class="aide">Ces coordonnées apparaissent sur le site et reçoivent les demandes.</p>
  </fieldset>

  <fieldset>
    <legend>Horaires</legend>
    <div class="row">${hoursFields}</div>
    <p class="aide">
      Un créneau par jour : <code>09:00-18:00</code>. Plusieurs créneaux se
      séparent par une virgule : <code>09:00-12:30, 13:30-18:00</code>.
      Laisser vide ferme la journée.
    </p>
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
    <button type="submit">Enregistrer les modifications</button>
  </div>
  <p class="aide">
    Enregistrer conserve vos changements, sans rien changer au site public.
    C'est « Mettre en ligne » qui les rend visibles.
  </p>
</form>

<form method="post" action="/clients/${escape(slug)}/publish">
  <div class="actions">
    <button type="submit" class="secondary">Mettre en ligne</button>
  </div>
  <p class="aide">
    Reconstruit le site avec le contenu enregistré et le déploie. Quelques
    dizaines de secondes. Refusé tant que l'état n'est pas « ${STATUTS.live.nom} ».
  </p>
</form>

<h2>Photos</h2>
<p class="aide">
  ${escape(String(photos.length))} fichier(s). Les images sont réduites et
  converties à l'envoi : inutile de les préparer avant. Pour remplacer une
  photo utilisée par le site, envoyez un fichier portant le même nom.
</p>

${
  photos.length > 0
    ? `<div class="media-grid">${photos
        .map((photo) => {
          const usage = usages.get(photo.name);
          return `<figure class="media">
      <img src="/clients/${escape(slug)}/media/${escape(photo.name)}" alt="" loading="lazy">
      <span class="media__usage" data-usage="${usage ? "utilise" : "libre"}">${escape(
        usage ?? "Non utilisée",
      )}</span>
      <figcaption>
        <span>${escape(photo.name)}</span>
        <span class="muted">${Math.round(photo.bytes / 1024)} ko</span>
      </figcaption>
      ${
        usage
          ? `<p class="aide">Utilisée par le site : elle ne peut pas être supprimée.
             Envoyez un fichier du même nom pour la remplacer.</p>`
          : `<form method="post" action="/clients/${escape(slug)}/media/${escape(photo.name)}/delete"
            data-confirmer="Supprimer ${escape(photo.name)} ? Cette action est définitive.">
        <button class="danger">Supprimer</button>
      </form>`
      }
    </figure>`;
        })
        .join("")}</div>`
    : `<p class="aide">Aucune photo pour l'instant.</p>`
}

<form method="post" action="/clients/${escape(slug)}/media" enctype="multipart/form-data">
  <label>Ajouter des photos
    <input type="file" name="photos" accept="image/*" multiple required>
  </label>
  <div class="actions"><button type="submit">Envoyer</button></div>
  <p class="aide">Jusqu'à 30 fichiers à la fois. Les photos envoyées n'apparaissent
    sur le site qu'après « Mettre en ligne ».</p>
</form>

<details class="avance">
  <summary>Édition avancée — contenu et traductions</summary>
  <div>
    <p class="aide">
      Tout le contenu du site, y compris les textes en néerlandais et en
      anglais, que le formulaire ci-dessus ne touche pas volontairement : un
      champ simplifié écraserait les traductions sans prévenir.
      Le format est vérifié à l'enregistrement — une erreur est refusée, elle
      ne casse pas le site.
    </p>
    <form method="post" action="/clients/${escape(slug)}/json">
      <label>site.json
        <textarea name="json" rows="24" spellcheck="false">${escape(
          JSON.stringify(readSiteRaw(slug), null, 2),
        )}</textarea>
      </label>
      <div class="actions"><button type="submit" class="secondary">Enregistrer le JSON</button></div>
    </form>
  </div>
</details>

<p style="margin-top:2rem"><a href="/">← Tous les clients</a></p>`,
    { authenticated: true, editeur: true },
  );
}

export function clientRoutes(app: FastifyInstance): void {
  app.get("/", async (_request, reply) => {
    const liste = clients();

    const cartes = await Promise.all(
      liste.map(async (slug) => {
        try {
          const { site } = client(slug);
          const etat = await etatPublication(slug);
          // Le point d'attention est porté jusqu'à la liste : sans cela, il
          // faut ouvrir chaque client pour savoir lequel attend une mise en
          // ligne — c'est-à-dire ne jamais le savoir.
          const attention =
            site.status === "live" && etat.enAttente
              ? `<div class="carte__pied">⬤ Modifications non publiées</div>`
              : site.status === "live"
                ? `<div class="carte__pied">En ligne · ${escape(depuis(etat.derniereMiseEnLigne))}</div>`
                : "";

          return `<a class="carte" href="/clients/${escape(slug)}">
            <div class="carte__titre">
              <b>${escape(site.business.name)}</b>
              <span class="badge" data-status="${escape(site.status)}">${escape(
                statutLisible(site.status),
              )}</span>
            </div>
            <div class="carte__ligne">${escape(site.domain)}</div>
            <div class="carte__ligne">palier ${escape(site.plan)}</div>
            ${attention}
          </a>`;
        } catch (error) {
          // Un client au fichier invalide doit rester visible : c'est
          // justement celui qu'il faut aller réparer.
          return `<a class="carte" href="/clients/${escape(slug)}">
            <div class="carte__titre"><b>${escape(slug)}</b></div>
            <div class="carte__ligne">Fichier illisible : ${escape(
              error instanceof Error ? error.message.split("\n")[0] : error,
            )}</div>
          </a>`;
        }
      }),
    );

    return reply.type("text/html").send(
      layout(
        "Clients",
        `<h1>Clients</h1>
<p class="intro">
  ${liste.length === 0 ? "Aucun client pour l'instant." : `${liste.length} commerce(s).`}
  Ouvrez une fiche pour modifier les horaires, les tarifs, les photos, puis
  mettre le site à jour.
</p>
<div class="cartes">${cartes.join("")}</div>`,
        { authenticated: true },
      ),
    );
  });

  app.get<{ Params: { slug: string } }>("/clients/:slug", async (request, reply) => {
    // On récupère l'état du dépôt avant d'afficher : éditer une version
    // périmée produirait un conflit au moment de pousser.
    await pull();
    return reply.type("text/html").send(await editPage(request.params.slug));
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
          .send(await editPage(slug, { kind: "error", text: written.errors.join(" · ") }));
      }

      const pushed = await commitAndPush(slug, `contenu(${slug}) : mise à jour depuis la console`);
      await logPublish(adminId(request), slug, "save", pushed.output.slice(0, 500));

      return reply.type("text/html").send(
        await editPage(slug, {
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
          await editPage(slug, {
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
          .send(await editPage(slug, { kind: "error", text: written.errors.join(" · ") }));
      }

      const pushed = await commitAndPush(slug, `contenu(${slug}) : édition JSON depuis la console`);
      await logPublish(adminId(request), slug, "save", "json");

      return reply.type("text/html").send(
        await editPage(slug, {
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
        await editPage(slug, {
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
        await editPage(slug, {
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
          await editPage(slug, {
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
        await editPage(slug, {
          kind: removed ? "ok" : "error",
          text: removed ? `${name} supprimée.` : "fichier introuvable",
        }),
      );
    },
  );
}
