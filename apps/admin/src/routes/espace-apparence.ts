import type { FastifyInstance } from "fastify";
import { STYLES, PALETTES, composerTheme, reconnaitrePreset } from "@bxl/schema/presets";
import { metierDe } from "@bxl/schema/metiers";
import { client, pull } from "../repo.ts";
import { utilisateur, siteDuCommercant } from "../acces.ts";
import { publierApparence } from "../publication.ts";
import { layoutClient, message } from "../views-client.ts";
import { grilleStyles, grillePalettes } from "../views/apparence-choix.ts";

/**
 * Le style et la couleur, côté commerçant.
 *
 * Les mêmes vignettes que dans la console de l'exploitant, et pour la même
 * raison qu'ailleurs : deux copies auraient divergé au premier style ajouté,
 * et l'une des deux listes aurait cessé de le proposer sans que rien ne le
 * signale.
 *
 * Seuls les styles du métier sont montrés. Un fleuriste ne doit pas pouvoir
 * choisir « Nuit », fait pour un salon de coiffure : il le prendrait, et son
 * site prendrait une typographie qui ne va pas à ses photos.
 *
 * Le changement se voit sur tout le site d'un coup — d'où la confirmation
 * avant l'envoi. C'est la seule page de cet espace où un appui distrait change
 * l'allure de chaque page à la fois.
 */

function page(
  slug: string,
  flash?: { ton: "ok" | "ko"; texte: string },
): string {
  const { site, theme } = client(slug);
  const metier = metierDe(site.business.type);

  const actif = reconnaitrePreset(theme);
  const styleActif = actif.style ?? "";
  const paletteActive = actif.palette ?? "";

  return layoutClient(
    "Mon style",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mon style</h1>
<p class="chapeau">
  L'allure de votre site : la façon dont les titres sont écrits, la disposition
  des photos, et les couleurs. Vos textes, vos horaires et vos tarifs ne
  bougent pas.
</p>

${
  styleActif || paletteActive
    ? ""
    : `<div class="etat" data-ton="alerte">
    <b>Votre site a été réglé à la main</b>
    <span>Il n'utilise aucun des styles ci-dessous. En choisir un remplacera
      son apparence actuelle — parlez-en à votre prestataire avant.</span>
  </div>`
}

<form method="post" action="/espace/apparence"
      data-confirmer="Changer le style modifie l'allure de tout votre site. Continuer ?">
  <h2>La forme</h2>
  <div class="choix-grille">${grilleStyles(styleActif, paletteActive, true, metier.id)}</div>

  <h2>La couleur</h2>
  <p class="aide">
    Toutes ont été vérifiées : le texte y reste lisible, y compris sur un
    téléphone en plein soleil.
  </p>
  <div class="teinte-grille">${grillePalettes(paletteActive)}</div>

  <div class="actions">
    <button type="submit" data-lent="Mise à jour du site…">Appliquer et mettre en ligne</button>
  </div>
  <p class="aide">
    Comptez une minute : votre site se reconstruit entièrement.
    Vous pouvez revenir en arrière à tout moment en rechoisissant l'ancien.
  </p>
</form>

<p class="aide" style="margin-top:2rem">
  Vous voulez autre chose que ces styles — vos propres couleurs, votre logo ?
  Écrivez à votre prestataire.
</p>`,
    { nomCommerce: site.business.name, retour: "/espace", script: true },
  );
}

export function espaceApparenceRoutes(app: FastifyInstance): void {
  app.get("/espace/apparence", async (request, reply) => {
    const slug = siteDuCommercant(utilisateur(request));
    await pull();
    return reply.type("text/html").send(page(slug));
  });

  app.post<{ Body: { style?: string; palette?: string } }>(
    "/espace/apparence",
    async (request, reply) => {
      const u = utilisateur(request);
      const slug = siteDuCommercant(u);
      const { style = "", palette = "" } = request.body ?? {};

      const refus = (texte: string) =>
        reply.code(400).type("text/html").send(page(slug, { ton: "ko", texte }));

      if (!STYLES[style] || !PALETTES[palette]) {
        return refus("Ce style ou cette couleur n'existe pas. Rien n'a été modifié.");
      }

      /*
       * Le style doit convenir au métier. La grille ne propose que les bons,
       * mais une requête envoyée à la main ne passe pas par la grille — et
       * rien ne signalerait qu'un fleuriste vient de recevoir la typographie
       * d'un barbier.
       */
      const metier = metierDe(client(slug).site.business.type);
      if (!STYLES[style]!.metiers.includes(metier.id)) {
        return refus("Ce style n'est pas proposé pour votre commerce. Rien n'a été modifié.");
      }

      const resultat = await publierApparence(slug, u.id, composerTheme(style, palette));

      return reply.type("text/html").send(
        page(slug, {
          ton: resultat.ok ? "ok" : "ko",
          texte: resultat.ok
            ? `Votre site est maintenant en « ${STYLES[style]!.nom} · ${PALETTES[palette]!.nom} ».`
            : resultat.message,
        }),
      );
    },
  );
}
