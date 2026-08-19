import type { FastifyInstance, FastifyRequest } from "fastify";
import { client, readSiteRaw, writeSite, commitAndPush, pull } from "../repo.ts";
import { projeterCommerce } from "../tenant.ts";
import { metierDe } from "@bxl/schema/metiers";
import { config } from "../config.ts";
import { logPublish, etatPublication } from "../db.ts";
import { layout, flash, escape, depuis } from "../views.ts";
import { saveMedia, MAX_UPLOAD_BYTES } from "../media.ts";
import { formatSlots } from "../hours.ts";
import { appliquerSection, estSection, type Champs } from "../contenu.ts";
import { EDITEUR_JS } from "../views/editeur-js.ts";
import {
  sectionAccueil,
  sectionPresentation,
  sectionHoraires,
  sectionGalerie,
  sectionDeroule,
  sectionEquipe,
  sectionAvis,
  sectionPrestations,
  sectionOccasions,
  sectionCarte,
  sectionPlanning,
  sectionLivraison,
  sectionDeuil,
  sectionAbonnements,
  sectionReferencement,
} from "../views/sections.ts";

/**
 * L'éditeur de contenu.
 *
 * Il remplace l'éditeur JSON pour tout ce qui se modifie couramment. Ce dernier
 * reste accessible depuis la fiche du client : il sert encore aux données
 * qu'aucun formulaire n'expose, et de recours si une section refuse un contenu.
 */

function adminId(request: FastifyRequest): number {
  return (request as FastifyRequest & { adminId: number }).adminId;
}

const TITRES: Record<string, string> = {
  accueil: "Accueil",
  presentation: "Le commerce",
  horaires: "Horaires",
  occasions: "Occasions",
  carte: "La carte",
  planning: "Le planning",
  galerie: "Galerie",
  deroule: "Le déroulé",
  equipe: "Équipe",
  avis: "Avis",
  prestations: "Prestations",
  deuil: "Fleurs de deuil",
  abonnements: "Abonnements",
  livraison: "Livraison",
  referencement: "Référencement",
};

/*
 * Les sections propres à un métier. Celles qui ne sont pas listées ici sont
 * communes à tous : accueil, horaires, galerie, avis, référencement.
 *
 * Un salon de coiffure à qui l'on propose « Fleurs de deuil » et
 * « Abonnements » se demande, à juste titre, si on lui a livré le bon outil.
 */
const SECTIONS_DU_METIER: Record<string, string> = {
  occasions: "occasions",
  carte: "carte",
  planning: "planning",
  livraison: "livraison",
  deuil: "deuil",
  abonnements: "abonnement",
  prestations: "prestations",
  deroule: "deroule",
  equipe: "equipe",
};

async function pageContenu(
  slug: string,
  message?: { kind: "ok" | "error"; text: string },
): Promise<string> {
  const { site } = client(slug);
  const defaut = site.languages.default;
  const etat = await etatPublication(slug);

  const metier = metierDe(site.business.type);
  const montre = (id: string) => {
    const requise = SECTIONS_DU_METIER[id];
    return requise === undefined || metier.sections.includes(requise as never);
  };

  const sommaire = Object.entries(TITRES)
    .filter(([id]) => montre(id))
    .map(([id, titre]) => `<a href="#${id}">${escape(titre)}</a>`)
    .join("");

  const bandeau =
    site.status === "live" && etat.enAttente
      ? `<div class="etat" data-etat="attente">
    <div class="etat__texte">
      <b>Modifications non publiées</b>
      <span>Enregistré ${escape(depuis(etat.derniereModification))}.
        Le site public affiche encore la version précédente.</span>
    </div>
    <form method="post" action="/clients/${escape(slug)}/publish">
      <button type="submit">Mettre en ligne</button>
    </form>
  </div>`
      : "";

  return layout(
    `Contenu — ${site.business.name}`,
    `<h1>Contenu du site</h1>
<p class="intro">
  ${escape(site.business.name)} ·
  <a href="/clients/${escape(slug)}">réglages et publication</a> ·
  <a href="https://${escape(site.domain)}" target="_blank" rel="noopener">voir le site ↗</a>
</p>

${message ? flash(message.kind, message.text) : ""}
${bandeau}

<nav class="sommaire">${sommaire}</nav>

${sectionAccueil(slug, site, defaut)}
${sectionPresentation(slug, site, defaut)}
${sectionHoraires(slug, site, formatSlots as (c: unknown) => string)}
${montre("carte") ? sectionCarte(slug, site, defaut) : ""}
${montre("planning") ? sectionPlanning(slug, site, defaut) : ""}
${montre("occasions") ? sectionOccasions(slug, site, defaut) : ""}
${sectionGalerie(slug, site, defaut)}
${montre("deroule") ? sectionDeroule(slug, site, defaut) : ""}
${montre("equipe") ? sectionEquipe(slug, site, defaut) : ""}
${sectionAvis(slug, site, defaut)}
${montre("prestations") ? sectionPrestations(slug, site, defaut) : ""}
${montre("deuil") ? sectionDeuil(slug, site, defaut) : ""}
${montre("abonnements") ? sectionAbonnements(slug, site, defaut) : ""}
${montre("livraison") ? sectionLivraison(slug, site, defaut) : ""}
${sectionReferencement(slug, site, defaut)}

<p style="margin-top:2rem"><a href="/clients/${escape(slug)}">← Réglages du client</a></p>`,
    { authenticated: true, editeur: true },
  );
}

export function contenuRoutes(app: FastifyInstance): void {
  /*
   * Le script est servi depuis le code plutôt que depuis un fichier : l'image
   * de la console ne copie que `src/`, et un fichier statique posé à côté
   * aurait été absent en production sans que rien ne le signale au build.
   */
  app.get("/assets/editeur.js", async (_request, reply) =>
    reply
      .type("application/javascript; charset=utf-8")
      .header("cache-control", "no-cache")
      .send(EDITEUR_JS),
  );

  app.get<{
    Params: { slug: string };
    Querystring: { ok?: string; erreur?: string; info?: string };
  }>("/clients/:slug/contenu", async (request, reply) => {
    // Le dépôt est rafraîchi avant affichage : éditer une version périmée
    // produirait un conflit au moment de pousser.
    await pull();

    const { ok, erreur, info } = request.query;
    /*
     * `info` porte une phrase entière, `ok` le nom d'une section. Deux
     * paramètres plutôt qu'un : arriver ici après une duplication n'a rien à
     * voir avec un enregistrement, et la phrase « … enregistré. Utilisez
     * Mettre en ligne » collée derrière n'aurait aucun sens.
     */
    const message = erreur
      ? { kind: "error" as const, text: erreur }
      : info
        ? { kind: "ok" as const, text: info }
        : ok
        ? {
            kind: "ok" as const,
            text: `${TITRES[ok] ?? ok} enregistré. Utilisez « Mettre en ligne » pour l'appliquer au site public.`,
          }
        : undefined;

    return reply.type("text/html").send(await pageContenu(request.params.slug, message));
  });

  app.post<{
    Params: { slug: string; section: string };
    Body: Record<string, string>;
  }>("/clients/:slug/section/:section", async (request, reply) => {
    const { slug, section } = request.params;

    if (!estSection(section)) {
      return reply.code(404).send("section inconnue");
    }

    const raw = readSiteRaw(slug);
    appliquerSection(raw, section, (request.body ?? {}) as Champs);

    /*
     * Réponse par redirection plutôt que par rendu direct : le rafraîchissement
     * de la page ne renvoie alors pas le formulaire, et l'ancre ramène la vue
     * sur la section qu'on venait d'enregistrer sans qu'un script ait à
     * déplacer la page.
     */
    const retour = (parametres: string) =>
      reply.redirect(
        `/clients/${encodeURIComponent(slug)}/contenu?${parametres}#${section}`,
        303,
      );

    const written = writeSite(slug, raw);
    if (!written.ok) {
      /*
       * Rien n'est écrit quand la validation échoue : la saisie fautive est
       * perdue, et c'est voulu — un site.json invalide casse la construction de
       * tous les sites, y compris ceux qui allaient bien.
       */
      return retour(
        `erreur=${encodeURIComponent(
          `${TITRES[section]} — non enregistré : ${written.errors.join(" · ")}`.slice(0, 300),
        )}`,
      );
    }

    /*
     * La base reçoit la même chose que git, dans la foulée.
     *
     * Les horaires, les prestations, les fermetures et l'équipe y sont
     * recopiés : l'agenda les lit à chaque requête et n'a pas accès au dépôt.
     * Tant que ce report n'existait pas, fermer le lundi dans l'éditeur
     * changeait le site sans changer la réservation — qui continuait
     * d'accepter le lundi.
     */
    const base = await projeterCommerce(client(slug).site);
    if (!base.ok) {
      return retour(
        `erreur=${encodeURIComponent(
          `${TITRES[section]} enregistré, mais la réservation n'a pas été mise à jour : ${base.message}`.slice(
            0,
            300,
          ),
        )}`,
      );
    }

    const pushed = await commitAndPush(slug, `contenu(${slug}) : ${section}`);
    await logPublish(adminId(request), slug, "save", `section: ${section}`);

    if (!pushed.ok) {
      return retour(
        `erreur=${encodeURIComponent(
          `${TITRES[section]} enregistré sur le serveur, mais l'envoi vers GitHub a échoué : ${pushed.output}`.slice(
            0,
            300,
          ),
        )}`,
      );
    }

    return retour(`ok=${encodeURIComponent(section)}`);
  });

  /*
   * Envoi d'une image seule, appelé par l'éditeur au dépôt.
   *
   * Distinct de l'envoi groupé de la fiche client : celui-ci répond en JSON et
   * ne commite pas. Le fichier n'entre dans git qu'à l'enregistrement de la
   * section, avec le contenu qui l'utilise — sinon une image déposée puis
   * abandonnée resterait versionnée pour rien.
   */
  app.post<{ Params: { slug: string } }>(
    "/clients/:slug/media/upload",
    async (request, reply) => {
      const { slug } = request.params;
      const part = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
      if (!part) return reply.code(400).send({ error: "aucun fichier reçu" });

      const buffer = await part.toBuffer();
      const result = await saveMedia(config.REPO_PATH, slug, part.filename, buffer);
      if (!result.ok || !result.name) {
        return reply.code(400).send({ error: result.error ?? "envoi refusé" });
      }

      return reply.send({ name: result.name });
    },
  );
}
