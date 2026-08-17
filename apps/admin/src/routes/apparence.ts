import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { STYLES, PALETTES, composerTheme, reconnaitrePreset } from "@bxl/schema/presets";
import { client, commitAndPush, pull } from "../repo.ts";
import { config } from "../config.ts";
import { logPublish } from "../db.ts";
import { layout, flash, escape } from "../views.ts";
import { grilleStyles, grillePalettes } from "../views/apparence-choix.ts";

/**
 * Choix de l'apparence : un style et une couleur.
 *
 * C'est l'outil de vente autant que l'outil de réglage. En clientèle, montrer
 * le même commerce sous cinq formes en quelques secondes vaut mieux que
 * décrire ce qu'on pourrait faire — et le commerçant choisit lui-même, ce qui
 * emporte la décision bien plus sûrement qu'une maquette imposée.
 *
 * Les deux axes sont indépendants : la forme tient à la typographie et à la
 * disposition, la couleur se change en une seconde. Les croiser donne trente
 * combinaisons à partir de onze définitions.
 */

function adminId(request: FastifyRequest): number {
  return (request as FastifyRequest & { adminId: number }).adminId;
}

function pageApparence(
  slug: string,
  message?: { kind: "ok" | "error"; text: string },
): string {
  const { site, theme } = client(slug);

  /*
   * Le thème dit lui-même ce qu'il applique quand il porte la trace du choix.
   * Sinon, on la retrouve en comparant ses valeurs : sans cela, un thème réglé
   * à la main — ou écrit avant que cette trace existe — ouvrait cette page sans
   * qu'aucune sélection ne soit marquée, comme si rien n'était appliqué.
   */
  const actif = reconnaitrePreset(theme);
  const styleActif = actif.style ?? "";
  const paletteActive = actif.palette ?? "";

  const styles = grilleStyles(styleActif, paletteActive);
  const palettes = grillePalettes(paletteActive);

  return layout(
    `Apparence — ${site.business.name}`,
    `<h1>Apparence</h1>
<p class="intro">
  ${escape(site.business.name)} ·
  <a href="/clients/${escape(slug)}">réglages et publication</a> ·
  <a href="/clients/${escape(slug)}/contenu">contenu</a>
</p>

${message ? flash(message.kind, message.text) : ""}

${
  styleActif || paletteActive
    ? ""
    : `<div class="etat" data-etat="attente">
    <div class="etat__texte">
      <b>Apparence réglée à la main</b>
      <span>Ce site n'utilise aucun style prédéfini. En choisir un remplacera
        ses polices, sa disposition et ses couleurs.</span>
    </div>
  </div>`
}

<form method="post" action="/clients/${escape(slug)}/apparence">
  <h2>Le style</h2>
  <p class="aide">Typographie, disposition et matière. C'est lui qui fait
    qu'un site ressemble à un barbier ou à un salon.</p>
  <div class="choix-grille">${styles}</div>

  <h2>La couleur</h2>
  <p class="aide">Toutes ces palettes ont été vérifiées : le texte y reste
    lisible, y compris sur un téléphone en plein soleil.</p>
  <div class="teinte-grille">${palettes}</div>

  <div class="actions">
    <button type="submit">Appliquer l'apparence</button>
  </div>
  <p class="aide">
    Remplace le thème du site. Le contenu, les photos et les horaires ne
    bougent pas. Comme pour le reste, il faut ensuite « Mettre en ligne » pour
    que le public le voie.
  </p>
</form>

<p style="margin-top:2rem"><a href="/clients/${escape(slug)}">← Réglages du client</a></p>`,
    { authenticated: true, editeur: true },
  );
}

export function apparenceRoutes(app: FastifyInstance): void {
  app.get<{ Params: { slug: string } }>(
    "/clients/:slug/apparence",
    async (request, reply) => {
      await pull();
      return reply.type("text/html").send(pageApparence(request.params.slug));
    },
  );

  app.post<{
    Params: { slug: string };
    Body: { style?: string; palette?: string };
  }>("/clients/:slug/apparence", async (request, reply) => {
    const { slug } = request.params;
    const { style = "", palette = "" } = request.body ?? {};

    if (!STYLES[style] || !PALETTES[palette]) {
      return reply
        .code(400)
        .type("text/html")
        .send(
          pageApparence(slug, {
            kind: "error",
            text: "Style ou couleur inconnu — rien n'a été modifié.",
          }),
        );
    }

    const theme = composerTheme(style, palette);
    const chemin = join(config.REPO_PATH, "clients", slug, "theme.json");
    writeFileSync(chemin, `${JSON.stringify(theme, null, 2)}\n`);

    const pushed = await commitAndPush(slug, `apparence(${slug}) : ${style} · ${palette}`);
    await logPublish(adminId(request), slug, "save", `apparence: ${style}/${palette}`);

    return reply.type("text/html").send(
      pageApparence(slug, {
        kind: pushed.ok ? "ok" : "error",
        text: pushed.ok
          ? `Apparence « ${STYLES[style]!.nom} · ${PALETTES[palette]!.nom} » enregistrée. Utilisez « Mettre en ligne » pour l'appliquer au site public.`
          : `Enregistré sur le serveur, mais l'envoi vers GitHub a échoué : ${pushed.output.slice(0, 200)}`,
      }),
    );
  });
}
