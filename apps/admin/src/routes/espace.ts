import type { FastifyInstance, FastifyRequest } from "fastify";
import { client, pull } from "../repo.ts";
import { comptesDuCommerce, changerMotDePasse, findAdminById, commandesEnAttente } from "../db.ts";
import { hashPassword, verifyPassword } from "../auth.ts";
import { utilisateur, siteDuCommercant } from "../acces.ts";
import { layoutClient, message, PAGES, periodeLisible, titrePage } from "../views-client.ts";
import { metierDe } from "@bxl/schema/metiers";
import { escape } from "../views.ts";
import { ESPACE_JS } from "../views/espace-js.ts";
import { espaceFermeturesRoutes } from "./espace-fermetures.ts";
import { espaceContenuRoutes } from "./espace-contenu.ts";
import { espaceAgendaRoutes } from "./espace-agenda.ts";
import { espaceCommandesRoutes } from "./espace-commandes.ts";
import { espaceApparenceRoutes } from "./espace-apparence.ts";

/**
 * L'espace du commerçant : accueil et compte.
 *
 * Toutes les routes de cet espace commencent par `/espace`, et toutes tirent le
 * site à ouvrir de la **session**, jamais de l'URL. C'est la règle qui rend
 * impossible la confusion entre deux salons : il n'y a aucun paramètre à
 * falsifier, parce qu'il n'y en a pas.
 */

export function adminIdDe(request: FastifyRequest): number {
  return utilisateur(request).id;
}

/* -------------------------------------------------------------------------- */
/* Accueil                                                                    */
/* -------------------------------------------------------------------------- */

async function pageAccueil(
  slug: string,
  flash?: { ton: "ok" | "ko"; texte: string },
): Promise<string> {
  const { site } = client(slug);
  const metier = metierDe(site.business.type);
  const comptes = await comptesDuCommerce(slug);
  const commandes = metier.commande === "commande" ? await commandesEnAttente(slug) : 0;

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const prochaines = site.closures
    .filter((f) => f.to >= aujourdhui)
    .sort((a, b) => a.from.localeCompare(b.from));

  /*
   * Le bandeau répond à la seule question qui se pose en ouvrant : « suis-je
   * annoncé fermé en ce moment ? ». C'est la source d'angoisse d'un commerçant
   * qui a cliqué la veille et n'est pas certain que ça a pris.
   */
  const ferme = prochaines.find((f) => f.from <= aujourdhui && f.to >= aujourdhui);
  const bandeau = ferme
    ? `<div class="etat" data-ton="alerte">
    <b>Votre salon est annoncé fermé aujourd'hui</b>
    <span>${escape(periodeLisible(ferme.from, ferme.to))}. Aucun rendez-vous ne
      peut être pris pendant cette période.</span>
    <a class="etat__lien" href="/espace/fermetures">Modifier →</a>
  </div>`
    : prochaines.length > 0
      ? `<div class="etat">
    <b>Prochaine fermeture</b>
    <span>${escape(periodeLisible(prochaines[0]!.from, prochaines[0]!.to))}.</span>
    <a class="etat__lien" href="/espace/fermetures">Voir mes fermetures →</a>
  </div>`
      : `<div class="etat">
    <b>Tout est ouvert</b>
    <span>Aucune fermeture prévue. Vos horaires habituels s'appliquent.</span>
  </div>`;

  const carte = (page: keyof typeof PAGES, compte?: number) => {
    const p = PAGES[page];
    return `<a href="/espace/${escape(page)}">
      <span class="menu__icone" aria-hidden="true">${p.icone}</span>
      <span class="menu__texte">
        <b>${escape(titrePage(metier.id, page))}</b>
        <span>${escape(p.sous)}</span>
      </span>
      ${compte ? `<span class="menu__compte">${compte}</span>` : ""}
    </a>`;
  };

  return layoutClient(
    site.business.name,
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Bonjour</h1>
<p class="chapeau">
  Tout ce que vous modifiez ici part en ligne tout de suite, sur
  <a href="https://${escape(site.domain)}" target="_blank" rel="noopener">${escape(site.domain)}</a>.
</p>

${bandeau}

<div class="menu">
  ${carte("fermetures")}
  ${carte("horaires")}
  ${carte("tarifs")}
  ${carte("photos")}
  ${carte("presentation")}
  ${carte("apparence")}
  ${
    /*
     * Un fleuriste voit ses commandes, un coiffeur ses rendez-vous. Jamais les
     * deux : proposer une page vide dont le nom ne veut rien dire pour son
     * métier fait douter de tout le reste.
     */
    metier.commande === "commande"
      ? carte("commandes", commandes)
      : site.booking.mode === "live"
        ? carte("rendez-vous", comptes.rendezVous)
        : ""
  }
  ${carte("messages", comptes.messages)}
</div>

<p class="aide">
  Une question, ou quelque chose que vous ne trouvez pas ici ?
  Écrivez à votre prestataire — il a accès au reste.
</p>
<p class="aide"><a href="/espace/mot-de-passe">Changer mon mot de passe</a></p>`,
    { nomCommerce: site.business.name },
  );
}

/* -------------------------------------------------------------------------- */
/* Mot de passe                                                               */
/* -------------------------------------------------------------------------- */

function pageMotDePasse(
  nom: string,
  obligatoire: boolean,
  flash?: { ton: "ok" | "ko"; texte: string },
): string {
  return layoutClient(
    "Mon mot de passe",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>${obligatoire ? "Choisissez votre mot de passe" : "Changer mon mot de passe"}</h1>
<p class="chapeau">
  ${
    obligatoire
      ? "Celui qu'on vous a communiqué a été vu par quelqu'un d'autre que vous. Choisissez-en un que vous êtes seul à connaître."
      : "Au moins dix caractères."
  }
</p>

<form method="post" action="/espace/mot-de-passe">
  <label>Mot de passe actuel
    <input type="password" name="actuel" required autocomplete="current-password">
  </label>
  <label>Nouveau mot de passe
    <input type="password" name="nouveau" required minlength="10"
           autocomplete="new-password">
  </label>
  <label>Le même, pour être sûr
    <input type="password" name="confirmation" required minlength="10"
           autocomplete="new-password">
  </label>
  <div class="actions">
    <button type="submit">Enregistrer</button>
  </div>
</form>`,
    { nomCommerce: nom, retour: obligatoire ? undefined : "/espace" },
  );
}

/* -------------------------------------------------------------------------- */

export function espaceRoutes(app: FastifyInstance): void {
  /*
   * Servi depuis le code, comme celui de l'éditeur : l'image de la console ne
   * copie que `src/`, et un fichier statique posé à côté serait absent en
   * production sans que rien ne le signale au build.
   */
  app.get("/assets/espace.js", async (_request, reply) =>
    reply
      .type("application/javascript; charset=utf-8")
      .header("cache-control", "no-cache")
      .send(ESPACE_JS),
  );

  app.get("/espace", async (request, reply) => {
    const slug = siteDuCommercant(utilisateur(request));
    // Le dépôt peut avoir bougé : l'exploitant travaille peut-être sur le même
    // site depuis sa console.
    await pull();
    return reply.type("text/html").send(await pageAccueil(slug));
  });

  app.get("/espace/mot-de-passe", async (request, reply) => {
    const u = utilisateur(request);
    const { site } = client(siteDuCommercant(u));
    return reply
      .type("text/html")
      .send(pageMotDePasse(site.business.name, u.motDePasseAChanger));
  });

  app.post<{ Body: { actuel?: string; nouveau?: string; confirmation?: string } }>(
    "/espace/mot-de-passe",
    {
      // Un mot de passe actuel se devine par essais successifs si on laisse
      // essayer.
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    },
    async (request, reply) => {
      const u = utilisateur(request);
      const { site } = client(siteDuCommercant(u));
      const { actuel = "", nouveau = "", confirmation = "" } = request.body ?? {};

      const refus = (texte: string) =>
        reply
          .code(400)
          .type("text/html")
          .send(pageMotDePasse(site.business.name, u.motDePasseAChanger, { ton: "ko", texte }));

      if (nouveau.length < 10) {
        return refus("Le nouveau mot de passe doit faire au moins dix caractères.");
      }
      if (nouveau !== confirmation) {
        return refus("Les deux nouveaux mots de passe ne sont pas identiques.");
      }

      const compte = await findAdminById(u.id);
      if (!compte || !(await verifyPassword(actuel, compte.password_hash))) {
        return refus("Le mot de passe actuel est incorrect.");
      }
      if (await verifyPassword(nouveau, compte.password_hash)) {
        return refus("Le nouveau mot de passe est identique à l'ancien.");
      }

      await changerMotDePasse(compte.id, await hashPassword(nouveau));

      return reply
        .type("text/html")
        .send(
          await pageAccueil(siteDuCommercant(u), {
            ton: "ok",
            texte: "Mot de passe modifié.",
          }),
        );
    },
  );

  espaceFermeturesRoutes(app);
  espaceContenuRoutes(app);
  espaceAgendaRoutes(app);
  espaceCommandesRoutes(app);
  espaceApparenceRoutes(app);
}

export { pageAccueil };
