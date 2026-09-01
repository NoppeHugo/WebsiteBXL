import type { FastifyInstance } from "fastify";
import { ecolesListees, fermerEcole } from "../db-ecole.ts";
import { layout, flash, escape, depuis } from "../views.ts";

/**
 * Les écoles ouvertes sur la plateforme, vues par l'exploitant.
 *
 * ─── Pourquoi cette page existe ───────────────────────────────────────────
 *
 * Parce que l'inscription à l'espace de cours est libre (`routes/inscription.ts`),
 * et qu'une porte ouverte sans fenêtre pour regarder qui entre est une porte
 * qu'on finit par condamner. Ici : qui s'est inscrit, avec combien d'élèves,
 * et depuis quand plus rien ne bouge.
 *
 * L'exploitant ne voit ni les exercices, ni les réponses, ni les corrections.
 * Ce ne sont pas ses données : ce sont celles d'une école, sur ses élèves, dont
 * certains sont mineurs. Il voit ce qu'il lui faut pour facturer et pour
 * fermer, et rien de plus.
 */

async function page(message?: { kind: "ok" | "error"; text: string }): Promise<string> {
  const ecoles = await ecolesListees();

  const cartes = ecoles
    .map(
      (e) => `<div class="carte" style="cursor:default">
  <div class="carte__titre">
    <b>${escape(e.nom)}</b>
    <span class="badge" data-status="${e.eleves > 0 ? "live" : "draft"}">${
      e.eleves > 0 ? `${e.eleves} élève(s)` : "Aucun élève"
    }</span>
  </div>
  <div class="carte__ligne">${escape(e.email)}</div>
  <div class="carte__ligne">${e.exercices} exercice(s)</div>
  <div class="carte__ligne">Ouverte ${escape(depuis(e.created_at))}</div>
  <div class="carte__ligne">Dernier travail d'élève : ${escape(
    depuis(e.derniere_activite),
  )}</div>
  <form method="post" action="/ecoles/${escape(e.id)}/fermer"
        data-confirmer="Fermer « ${escape(e.nom)} » ? Le compte, les élèves, les exercices et toutes les réponses seront supprimés."
        style="margin-top:0.8rem">
    <button type="submit" class="secondary">Fermer ce compte</button>
  </form>
</div>`,
    )
    .join("");

  return layout(
    "Écoles",
    `<h1>Écoles</h1>
<p class="intro">
  Les espaces de cours ouverts depuis <b>/inscription</b>. Un compte d'école ne
  donne accès à aucun site client : il ne voit que ses propres élèves et ses
  propres exercices.
</p>

${message ? flash(message.kind, message.text) : ""}

${
  ecoles.length === 0
    ? `<p class="intro">Aucune école inscrite pour l'instant.</p>`
    : `<div class="cartes">${cartes}</div>`
}

<p style="margin-top:2rem"><a href="/">← Tous les clients</a></p>`,
    { authenticated: true, editeur: true },
  );
}

export function ecolesRoutes(app: FastifyInstance): void {
  app.get("/ecoles", async (_request, reply) =>
    reply.type("text/html").send(await page()),
  );

  app.post<{ Params: { id: string } }>("/ecoles/:id/fermer", async (request, reply) => {
    await fermerEcole(request.params.id);
    // La session du responsable et celles de ses élèves meurent à leur requête
    // suivante : les comptes sont relus en base à chaque page.
    return reply
      .type("text/html")
      .send(await page({ kind: "ok", text: "École fermée." }));
  });
}
