import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { STYLES, PALETTES, composerTheme } from "@bxl/schema/presets";
import { client, commitAndPush, pull } from "../repo.ts";
import { config } from "../config.ts";
import { logPublish } from "../db.ts";
import { layout, flash, escape } from "../views.ts";

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

/**
 * Vignette d'un style : un titre, un filet, un bouton.
 *
 * Rendue avec les vraies polices et les vraies couleurs, pas une capture : elle
 * suit donc automatiquement toute modification d'un style, et pèse le poids
 * d'un peu de balisage.
 */
function vignette(styleId: string, paletteId: string): string {
  const style = STYLES[styleId]!.style;
  const palette = PALETTES[paletteId]!.palette;
  const rayon = { none: "0", soft: "10px", round: "18px" }[style.radius];

  return `<span class="vignette" style="
    background:${palette.bg};
    color:${palette.text};
    border-color:${palette.border};
  ">
    <span class="vignette__titre" style="
      font-family:${style.fonts.display};
      font-weight:${style.fonts.displayWeight};
      letter-spacing:${style.fonts.displayTracking};
      text-transform:${style.fonts.displayTransform};
    ">Aa</span>
    <span class="vignette__filet" style="background:${palette.border}"></span>
    <span class="vignette__btn" style="
      background:${palette.accent};
      color:${palette.accentText};
      border-radius:${rayon};
      font-family:${style.fonts.body};
      text-transform:${style.fonts.uiTransform};
      letter-spacing:${style.fonts.uiTracking};
    ">Réserver</span>
  </span>`;
}

function pageApparence(
  slug: string,
  message?: { kind: "ok" | "error"; text: string },
): string {
  const { site, theme } = client(slug);
  const styleActif = theme.preset?.style ?? "";
  const paletteActive = theme.preset?.palette ?? "";

  const styles = Object.entries(STYLES)
    .map(
      ([id, s]) => `<label class="choix${id === styleActif ? " est-actif" : ""}">
    <input type="radio" name="style" value="${escape(id)}"${
      id === styleActif ? " checked" : ""
    } required>
    ${vignette(id, paletteActive || "blanc")}
    <span class="choix__texte">
      <b>${escape(s.nom)}</b>
      <span>${escape(s.pour)}</span>
    </span>
  </label>`,
    )
    .join("");

  const palettes = Object.entries(PALETTES)
    .map(
      ([id, p]) => `<label class="teinte${id === paletteActive ? " est-actif" : ""}">
    <input type="radio" name="palette" value="${escape(id)}"${
      id === paletteActive ? " checked" : ""
    } required>
    <span class="teinte__pastilles">
      <span style="background:${p.palette.bg}"></span>
      <span style="background:${p.palette.surface}"></span>
      <span style="background:${p.palette.accent}"></span>
      <span style="background:${p.palette.text}"></span>
    </span>
    <b>${escape(p.nom)}</b>
  </label>`,
    )
    .join("");

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
  styleActif
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
