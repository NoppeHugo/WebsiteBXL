import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { loadClient } from "@bxl/schema/load";
import { config, domaineDeService } from "../config.ts";
import { client, readSiteRaw, commitAndPush, pull } from "../repo.ts";
import { logPublish } from "../db.ts";
import { projeterCommerce } from "../tenant.ts";
import { layout, flash, escape } from "../views.ts";
import { identifiant } from "../nouveau.ts";
import { dupliquer, validerCopie } from "../duplication.ts";

/**
 * Dupliquer un site.
 *
 * Le geste manquait : préparer un site pour un nouveau client obligeait à
 * repartir d'un squelette vide, alors qu'on a souvent sous la main un site
 * abouti du même métier — mêmes sections, même ton, mêmes prestations à un
 * prix près.
 *
 * La copie naît **en brouillon**, et rien n'est mis en ligne : ni bloc nginx,
 * ni certificat, ni fichiers déployés. C'est ce qui laisse tout le temps de
 * corriger ce qui désigne encore l'autre commerce. Le site ne devient public
 * qu'au moment où l'on appuie sur « Mettre en ligne ».
 */

function adminId(request: FastifyRequest): number {
  return (request as FastifyRequest & { adminId: number }).adminId;
}

function page(
  slug: string,
  saisie: { nom: string; slug: string },
  message?: { kind: "ok" | "error"; text: string },
): string {
  const { site } = client(slug);
  const service = domaineDeService();

  return layout(
    `Dupliquer — ${site.business.name}`,
    `<h1>Dupliquer ce site</h1>
<p class="intro">
  Copie de <b>${escape(site.business.name)}</b> pour en faire la base d'un
  autre commerce. Le site d'origine n'est pas touché.
</p>

${message ? flash(message.kind, message.text) : ""}

<div class="etat" data-etat="attente">
  <div class="etat__texte">
    <b>La copie reste hors ligne</b>
    <span>Elle est créée en brouillon : aucune adresse publique, aucun
      certificat, rien de déployé. Vous corrigez tranquillement ce qui doit
      l'être, et c'est « Mettre en ligne » qui la rend visible.</span>
  </div>
</div>

<form method="post" action="/clients/${escape(slug)}/dupliquer">
  <fieldset>
    <legend>Le nouveau commerce</legend>
    <div class="row">
      <label>Nom du commerce
        <input type="text" name="nom" value="${escape(saisie.nom)}" required
               autocomplete="off" autocapitalize="words" data-slug-source>
      </label>
    </div>
    <label>Adresse du site
      <span class="champ-suffixe">
        <input type="text" name="slug" value="${escape(saisie.slug)}" required
               pattern="[a-z0-9]+(-[a-z0-9]+)*" autocomplete="off"
               autocapitalize="none" spellcheck="false" data-slug-cible>
        <span class="suffixe">.${escape(service || "…")}</span>
      </span>
    </label>
    <p class="aide">
      Proposée d'après le nom, modifiable. C'est aussi le nom du dossier :
      il ne peut pas être celui d'un client existant.
    </p>
  </fieldset>

  <h2>Ce qui est repris</h2>
  <p class="aide">
    Les textes, les horaires, les prestations, les photos, l'équipe, les
    sections du métier et l'apparence. C'est tout l'intérêt : repartir d'un
    site abouti.
  </p>

  <h2>Ce qui n'est pas repris</h2>
  <p class="aide">
    Les <b>avis</b> — les recopier publierait des témoignages que personne n'a
    écrits pour ce commerce. Les <b>mentions légales</b>, qui portent le numéro
    d'entreprise et la TVA d'une autre société. Les <b>liens Google</b> et les
    <b>réseaux sociaux</b>, qui désignent l'autre commerce jusque dans les
    données que lit Google.
  </p>
  <p class="aide">
    L'identifiant technique du commerce est régénéré : sans cela, les deux
    sites recevraient les rendez-vous et les messages l'un de l'autre.
  </p>

  <h2>Ce qu'il faudra corriger</h2>
  <p class="aide">
    Le téléphone, l'e-mail et l'adresse sont recopiés pour vous servir de
    repère — ils désignent encore l'autre commerce. La fiche du nouveau site
    vous les rappellera tant qu'ils n'auront pas changé.
  </p>

  <div class="actions">
    <button type="submit" data-lent="Duplication…">Dupliquer et ouvrir l'éditeur</button>
  </div>
</form>

<p style="margin-top:2rem"><a href="/clients/${escape(slug)}">← Retour à ${escape(site.business.name)}</a></p>`,
    { authenticated: true, editeur: true },
  );
}

export function dupliquerRoutes(app: FastifyInstance): void {
  app.get<{ Params: { slug: string } }>(
    "/clients/:slug/dupliquer",
    async (request, reply) => {
      await pull();
      return reply
        .type("text/html")
        .send(page(request.params.slug, { nom: "", slug: "" }));
    },
  );

  app.post<{ Params: { slug: string }; Body: { nom?: string; slug?: string } }>(
    "/clients/:slug/dupliquer",
    async (request, reply) => {
      const source = request.params.slug;
      const nom = (request.body?.nom ?? "").trim();
      const cible = identifiant((request.body?.slug ?? "").trim() || nom);

      const refus = (texte: string) =>
        reply
          .code(400)
          .type("text/html")
          .send(page(source, { nom, slug: cible }, { kind: "error", text: texte }));

      if (!nom) return refus("Le nom du commerce est obligatoire.");
      if (!cible) {
        return refus(
          "Le nom ne donne aucune adresse utilisable — saisissez-la à la main.",
        );
      }
      if (cible === source) {
        return refus("La copie doit porter une adresse différente de l'original.");
      }

      const service = domaineDeService();
      if (!service) {
        return refus(
          "Domaine de service inconnu : renseignez SERVICE_DOMAIN ou PUBLIC_ADMIN_URL dans le .env du serveur.",
        );
      }

      // On se remet à jour avant d'écrire : un client créé depuis une autre
      // session rendrait le push impossible.
      await pull();

      const dossier = join(config.REPO_PATH, "clients", cible);
      if (existsSync(dossier)) {
        return refus(`Un client « ${cible} » existe déjà. Choisissez une autre adresse.`);
      }

      const copie = dupliquer(readSiteRaw(source), {
        slug: cible,
        nom,
        domaine: `${cible}.${service}`,
      });

      const controle = validerCopie(copie.site);
      if (!controle.ok) return refus(controle.erreurs.join(" · "));

      /*
       * Les fichiers d'abord, la base ensuite, git en dernier — même ordre que
       * la création d'un client. Une étape qui échoue s'arrête là et le dit,
       * mais laisse en place ce qui précède, qui est valide.
       */
      mkdirSync(dossier, { recursive: true });
      writeFileSync(
        join(dossier, "site.json"),
        `${JSON.stringify(copie.site, null, 2)}\n`,
      );

      // Le thème est copié tel quel : c'est la moitié de ce qu'on vient
      // chercher, et il ne porte aucune donnée propre au commerce.
      const themeSource = join(config.REPO_PATH, "clients", source, "theme.json");
      cpSync(themeSource, join(dossier, "theme.json"));

      /*
       * Les photos suivent, sans quoi le site ne se construirait pas : la
       * galerie et l'accueil désignent des fichiers par leur nom. Ce sont les
       * photos de l'autre commerce, et c'est assumé — la copie sert de base, et
       * elle reste hors ligne jusqu'à ce que l'exploitant les remplace.
       */
      const mediaSource = join(config.REPO_PATH, "clients", source, "media");
      if (existsSync(mediaSource)) {
        cpSync(mediaSource, join(dossier, "media"), { recursive: true });
      } else {
        mkdirSync(join(dossier, "media"), { recursive: true });
      }

      const charge = loadClient(config.REPO_PATH, cible);
      const base = await projeterCommerce(charge.site);
      if (!base.ok) {
        return refus(
          `Fichiers copiés, mais l'enregistrement en base a échoué : ${base.message}`,
        );
      }

      const pousse = await commitAndPush(
        cible,
        `nouveau client : ${cible}, dupliqué depuis ${source}`,
      );
      await logPublish(adminId(request), cible, "save", `dupliqué depuis ${source}`);
      if (!pousse.ok) {
        return refus(
          `Copie créée sur le serveur, mais l'envoi vers GitHub a échoué : ${pousse.output.slice(0, 300)}`,
        );
      }

      /*
       * On ouvre directement l'éditeur du nouveau site : c'est là qu'on va, et
       * repasser par sa fiche ferait un clic de plus pour rien. Ce qui a été
       * retiré est annoncé en arrivant.
       */
      const dit =
        copie.retire.length > 0
          ? `Copie de ${source} créée. Non repris : ${copie.retire.join(", ")}.`
          : `Copie de ${source} créée.`;
      return reply.redirect(
        `/clients/${encodeURIComponent(cible)}/contenu?info=${encodeURIComponent(dit)}`,
        303,
      );
    },
  );
}
