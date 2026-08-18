import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { loadClient } from "@bxl/schema/load";
import { config, domaineDeService } from "../config.ts";
import { commitAndPush, pull, installerSite } from "../repo.ts";
import { logPublish } from "../db.ts";
import { projeterCommerce } from "../tenant.ts";
import { layout, flash, escape } from "../views.ts";
import { grilleStyles, grillePalettes } from "../views/apparence-choix.ts";
import { metierDe } from "@bxl/schema/metiers";
import {
  TYPES_COMMERCE,
  identifiant,
  squelette,
  valider,
  styleConvient,
  type DemandeNouveauClient,
  type TypeCommerce,
} from "../nouveau.ts";

/**
 * Création d'un client, en clientèle, en une opération.
 *
 * Ce qu'il fallait faire avant : ouvrir une session sur le serveur, lancer
 * `pnpm new`, puis `pnpm tenant`, écrire un bloc nginx en root, demander un
 * certificat, construire, déployer. Six commandes dont deux en root, dans un
 * terminal, chez le client, sur un téléphone. Autant dire : au retour, le
 * lendemain — et l'élan de la visite est retombé.
 *
 * Ici, un formulaire. Ce qu'il demande, le commerçant l'a sous la main ou dans
 * la tête : son nom, son adresse, son téléphone, son e-mail. Ce qu'il ne
 * demande pas — prestations, tarifs, horaires, photos — se remplit juste après
 * dans l'éditeur, en le lui demandant, ce qui est de toute façon la
 * conversation à avoir.
 *
 * Deux moitiés, comme pour la publication : la console écrit dans git et en
 * base ; l'hôte fabrique les visuels, pose le bloc nginx, obtient le
 * certificat, construit et déploie. La frontière est celle des droits et des
 * bibliothèques natives, pas un choix d'organisation.
 */

function adminId(request: FastifyRequest): number {
  return (request as FastifyRequest & { adminId: number }).adminId;
}

interface Saisie {
  nom: string;
  slug: string;
  type: string;
  telephone: string;
  email: string;
  rue: string;
  codePostal: string;
  ville: string;
  plan: string;
  langues: string[];
  style: string;
  palette: string;
}

const SAISIE_VIDE: Saisie = {
  nom: "",
  slug: "",
  type: "hair_salon",
  telephone: "",
  email: "",
  rue: "",
  codePostal: "",
  ville: "",
  plan: "essentiel",
  langues: ["fr"],
  style: "maison",
  palette: "blanc",
};

function pageNouveau(
  saisie: Saisie,
  message?: { kind: "ok" | "error"; text: string },
): string {
  const service = domaineDeService();
  const apercuDomaine = saisie.slug && service ? `${saisie.slug}.${service}` : "";

  const types = Object.entries(TYPES_COMMERCE)
    .map(
      ([id, nom]) =>
        `<option value="${escape(id)}" data-metier="${escape(metierDe(id).id)}"${
          id === saisie.type ? " selected" : ""
        }>${escape(nom)}</option>`,
    )
    .join("");

  const plans = (["essentiel", "pro", "signature"] as const)
    .map(
      (p) =>
        `<option value="${p}"${p === saisie.plan ? " selected" : ""}>${p[0]!.toUpperCase()}${p.slice(1)}</option>`,
    )
    .join("");

  const langues = (
    [
      ["fr", "Français"],
      ["nl", "Nederlands"],
      ["en", "English"],
    ] as const
  )
    .map(
      ([code, nom]) => `<label class="case">
        <input type="checkbox" name="langues" value="${code}"${
          saisie.langues.includes(code) ? " checked" : ""
        }>
        <span>${nom}</span>
      </label>`,
    )
    .join("");

  return layout(
    "Nouveau client",
    `<h1>Nouveau client</h1>
<p class="intro">
  Le site est créé, mis en ligne à son adresse et prêt à être montré. Il reste
  <b>invisible pour Google</b> jusqu'à ce que vous le passiez en « En ligne ».
</p>

${message ? flash(message.kind, message.text) : ""}

${
  service
    ? ""
    : `<div class="etat" data-etat="attente">
    <div class="etat__texte">
      <b>Domaine de service inconnu</b>
      <span>Ni <code>SERVICE_DOMAIN</code> ni <code>PUBLIC_ADMIN_URL</code> ne
        permettent de déduire sous quel domaine créer le sous-domaine du client.
        Renseignez l'un des deux dans le <code>.env</code> du serveur.</span>
    </div>
  </div>`
}

<form method="post" action="/clients/nouveau" id="form-nouveau">
  <fieldset>
    <legend>Le commerce</legend>
    <div class="row">
      <label>Nom du commerce
        <input type="text" name="nom" value="${escape(saisie.nom)}" required
               autocomplete="off" autocapitalize="words" data-slug-source>
      </label>
      <label>Type
        <select name="type" data-type-commerce>${types}</select>
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
    <p class="aide" data-slug-apercu>
      ${
        apercuDomaine
          ? `Le site sera à l'adresse <b>https://${escape(apercuDomaine)}</b>.`
          : "Proposée d'après le nom, modifiable. Minuscules et tirets uniquement."
      }
      Un domaine propre (par exemple <code>salonmarie.be</code>) se met en place
      ensuite, sans perdre celle-ci.
    </p>

    <div class="row">
      <label>Téléphone
        <input type="tel" name="telephone" value="${escape(saisie.telephone)}"
               required placeholder="+32 2 000 00 00" autocomplete="off">
      </label>
      <label>E-mail du commerce
        <input type="email" name="email" value="${escape(saisie.email)}" required
               autocomplete="off" spellcheck="false">
      </label>
    </div>
    <p class="aide">
      L'e-mail reçoit les demandes envoyées par le formulaire de contact.
      Demandez celle qui est relevée tous les jours, pas celle de la création
      de l'entreprise.
    </p>

    <label>Rue et numéro
      <input type="text" name="rue" value="${escape(saisie.rue)}" required autocomplete="off">
    </label>
    <div class="row">
      <label>Code postal
        <input type="text" name="codePostal" value="${escape(saisie.codePostal)}"
               required inputmode="numeric" autocomplete="off">
      </label>
      <label>Commune
        <input type="text" name="ville" value="${escape(saisie.ville)}" required autocomplete="off">
      </label>
    </div>
    <p class="aide">
      L'adresse part dans les données que lisent Google et Apple Plans : une
      erreur ici envoie les clients à la mauvaise porte.
    </p>
  </fieldset>

  <fieldset>
    <legend>Formule et langues</legend>
    <div class="row">
      <label>Palier
        <select name="plan">${plans}</select>
      </label>
    </div>
    <div class="cases">${langues}</div>
    <p class="aide">
      La première langue cochée est la principale. Une langue ajoutée plus tard
      demande de retraduire tous les textes déjà écrits — mieux vaut trancher
      maintenant, avec le commerçant.
    </p>
  </fieldset>

  <h2>Le style</h2>
  <p class="aide">Modifiable à tout moment ensuite, en quelques secondes.
    Autant le choisir avec lui : c'est ce qui emporte la décision.
    La liste suit le type de commerce choisi plus haut.</p>
  <div class="choix-grille" data-grille-styles>${grilleStyles(saisie.style, saisie.palette, false)}</div>

  <h2>La couleur</h2>
  <div class="teinte-grille">${grillePalettes(saisie.palette, false)}</div>

  <div class="actions">
    <button type="submit" data-lent="Création en cours…">Créer le site</button>
  </div>
  <p class="aide">
    Compte une minute environ : visuels, certificat, construction et mise en
    ligne. Ne fermez pas la page.
  </p>
</form>

<p style="margin-top:2rem"><a href="/">← Tous les clients</a></p>`,
    { authenticated: true, editeur: true },
  );
}

/** Relit le formulaire sans rien supposer de ce qu'il contient. */
function lireSaisie(body: Record<string, unknown>): Saisie {
  const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const langues = Array.isArray(body.langues)
    ? body.langues.filter((l): l is string => typeof l === "string")
    : typeof body.langues === "string"
      ? [body.langues]
      : [];

  return {
    nom: texte(body.nom),
    // Un identifiant laissé vide se déduit du nom : le champ est prérempli par
    // le navigateur, mais un envoi sans JavaScript doit aboutir quand même.
    slug: identifiant(texte(body.slug) || texte(body.nom)),
    type: texte(body.type) || "hair_salon",
    telephone: texte(body.telephone),
    email: texte(body.email),
    rue: texte(body.rue),
    codePostal: texte(body.codePostal),
    ville: texte(body.ville),
    plan: texte(body.plan) || "essentiel",
    // L'ordre du schéma, pas celui des cases : la principale est la première
    // cochée telle que le formulaire les présente.
    langues: ["fr", "nl", "en"].filter((l) => langues.includes(l)),
    style: texte(body.style) || "maison",
    palette: texte(body.palette) || "blanc",
  };
}

export function nouveauRoutes(app: FastifyInstance): void {
  app.get("/clients/nouveau", async (_request, reply) =>
    reply.type("text/html").send(pageNouveau(SAISIE_VIDE)),
  );

  app.post<{ Body: Record<string, unknown> }>(
    "/clients/nouveau",
    async (request, reply) => {
      const saisie = lireSaisie(request.body ?? {});
      const refus = (text: string) =>
        reply.code(400).type("text/html").send(pageNouveau(saisie, { kind: "error", text }));

      if (!saisie.slug) {
        return refus("Le nom du commerce ne donne aucun identifiant utilisable — corrigez l'adresse du site à la main.");
      }
      if (saisie.langues.length === 0) {
        return refus("Cochez au moins une langue.");
      }
      if (!(saisie.type in TYPES_COMMERCE)) {
        return refus("Type de commerce inconnu.");
      }
      /*
       * Le style doit convenir au type choisi. Le cas se produit sans mauvaise
       * volonté : on choisit un style, puis on change le type au-dessus, et le
       * formulaire part avec l'ancien.
       */
      if (!styleConvient(saisie.type, saisie.style)) {
        return refus(
          `Le style choisi n'est pas proposé pour « ${TYPES_COMMERCE[saisie.type as TypeCommerce]} » — choisissez-en un dans la liste ci-dessous.`,
        );
      }

      const service = domaineDeService();
      if (!service) {
        return refus(
          "Domaine de service inconnu : renseignez SERVICE_DOMAIN ou PUBLIC_ADMIN_URL dans le .env du serveur.",
        );
      }

      // On se remet à jour avant d'écrire : un client créé depuis une autre
      // session, ou un thème modifié entre-temps, rendrait le push impossible.
      await pull();

      const dossier = join(config.REPO_PATH, "clients", saisie.slug);
      if (existsSync(dossier)) {
        return refus(
          `Un client « ${saisie.slug} » existe déjà. Choisissez une autre adresse de site.`,
        );
      }

      const demande: DemandeNouveauClient = {
        slug: saisie.slug,
        nom: saisie.nom,
        type: saisie.type as TypeCommerce,
        domaine: `${saisie.slug}.${service}`,
        telephone: saisie.telephone,
        email: saisie.email,
        rue: saisie.rue,
        codePostal: saisie.codePostal,
        ville: saisie.ville,
        plan: saisie.plan as "essentiel" | "pro" | "signature",
        langues: saisie.langues,
        style: saisie.style,
        palette: saisie.palette,
      };

      const s = squelette(demande);
      const controle = valider(s);
      if (!controle.ok) return refus(controle.erreurs.join(" · "));

      /*
       * À partir d'ici on écrit. L'ordre suit la dépendance : les fichiers,
       * puis la base qui les relit, puis git, puis l'hôte. Chaque étape qui
       * échoue s'arrête là et le dit — mais laisse en place ce qui précède,
       * qui est valide. Défaire une création à moitié faite demanderait de
       * supprimer un dossier, une ligne en base et un commit : trois façons
       * d'effacer autre chose que ce qu'on croit.
       */
      mkdirSync(join(dossier, "media"), { recursive: true });
      writeFileSync(join(dossier, "site.json"), `${JSON.stringify(s.site, null, 2)}\n`);
      writeFileSync(join(dossier, "theme.json"), `${JSON.stringify(s.theme, null, 2)}\n`);

      const charge = loadClient(config.REPO_PATH, saisie.slug);
      const base = await projeterCommerce(charge.site);
      if (!base.ok) {
        return refus(
          `Fichiers créés, mais l'enregistrement en base a échoué : ${base.message}` +
            " — le formulaire de contact ne fonctionnera pas tant que ce n'est pas réglé.",
        );
      }

      const pousse = await commitAndPush(
        saisie.slug,
        `nouveau client : ${saisie.slug} (${saisie.style} · ${saisie.palette})`,
      );
      await logPublish(adminId(request), saisie.slug, "save", "création du client");
      if (!pousse.ok) {
        return refus(
          `Client créé sur le serveur, mais l'envoi vers GitHub a échoué : ${pousse.output.slice(0, 300)}`,
        );
      }

      /*
       * L'hôte prend le relais : visuels, bloc nginx, certificat, construction,
       * déploiement. C'est la partie longue — une minute environ.
       */
      const installation = await installerSite(saisie.slug);
      await logPublish(
        adminId(request),
        saisie.slug,
        "publish",
        installation.output.slice(0, 1000),
      );

      if (!installation.ok) {
        return reply
          .code(500)
          .type("text/html")
          .send(
            pageNouveau(saisie, {
              kind: "error",
              text:
                "Le client est créé et enregistré, mais sa mise en ligne a échoué. " +
                "Sa fiche existe : ouvrez-la et relancez « Mettre en ligne ». " +
                `Détail : ${installation.output.slice(-600)}`,
            }),
          );
      }

      return reply.redirect(`/clients/${saisie.slug}?cree=1`, 303);
    },
  );
}
