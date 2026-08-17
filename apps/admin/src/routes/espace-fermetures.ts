import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { client, pull } from "../repo.ts";
import { utilisateur, siteDuCommercant } from "../acces.ts";
import { enregistrerEtPublier } from "../publication.ts";
import { layoutClient, message, periodeLisible, dateLisible } from "../views-client.ts";
import { escape } from "../views.ts";
import type { Champs } from "../contenu.ts";

/**
 * « Je ferme. »
 *
 * La raison d'être de tout cet espace. C'est la modification la plus fréquente
 * et la plus urgente qu'un commerçant ait à faire, la seule qui ne puisse pas
 * attendre — et la seule dont l'oubli se paie par un client devant une porte
 * close, un samedi matin.
 *
 * Trois appuis suffisent : « Aujourd'hui », puis « Enregistrer ». Les dates
 * sont préremplies parce qu'un champ date vide, sur un téléphone, ouvre un
 * sélecteur au mois en cours et demande de viser.
 *
 * ─── Ce qui se passe à l'enregistrement ────────────────────────────────────
 *
 * La base d'abord : la réservation cesse immédiatement d'accepter ces jours-là.
 * Le site public ensuite. Si la reconstruction échoue, le site affiche encore
 * les anciennes dates — mais plus personne ne peut réserver. C'est le bon sens
 * de l'ordre : mieux vaut un site en retard qu'un agenda qui accepte.
 */

function aujourdhui(): string {
  // Dans le fuseau du commerce, pas celui du serveur : à 1 h du matin en
  // juillet, UTC est encore la veille, et « Aujourd'hui » fermerait hier.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
}

function decale(jours: number): string {
  const base = new Date(`${aujourdhui()}T12:00:00`);
  base.setDate(base.getDate() + jours);
  return base.toISOString().slice(0, 10);
}

function page(
  slug: string,
  flash?: { ton: "ok" | "ko"; texte: string },
  prerempli?: { du: string; au: string },
): string {
  const { site } = client(slug);
  const jour = aujourdhui();

  const aVenir = site.closures
    .filter((f) => f.to >= jour)
    .sort((a, b) => a.from.localeCompare(b.from));

  const passees = site.closures
    .filter((f) => f.to < jour)
    .sort((a, b) => b.from.localeCompare(a.from))
    .slice(0, 5);

  /*
   * La liste des fermetures est renvoyée en entier à chaque enregistrement,
   * champs cachés compris : c'est ce qui permet à une suppression d'être un
   * simple retrait de ligne, sans route ni identifiant à part.
   */
  const cachees = (fermetures: typeof site.closures, depuis: number) =>
    fermetures
      .map(
        (f, i) => `<input type="hidden" name="closures.${depuis + i}.from" value="${escape(f.from)}">
    <input type="hidden" name="closures.${depuis + i}.to" value="${escape(f.to)}">
    ${
      f.reason
        ? Object.entries(f.reason)
            .map(
              ([langue, texte]) =>
                `<input type="hidden" name="closures.${depuis + i}.reason.${escape(langue)}" value="${escape(texte)}">`,
            )
            .join("")
        : ""
    }`,
      )
      .join("");

  const liste =
    aVenir.length === 0
      ? `<p class="vide">Aucune fermeture prévue.<br>Votre salon suit ses horaires habituels.</p>`
      : aVenir
          .map((f, i) => {
            const encours = f.from <= jour && f.to >= jour;
            return `<div class="fiche">
      <div class="fiche__titre">${escape(periodeLisible(f.from, f.to))}</div>
      <div class="fiche__detail">
        ${encours ? "En cours — vous êtes annoncé fermé." : "À venir."}
        ${f.reason ? ` ${escape(Object.values(f.reason)[0] ?? "")}` : ""}
      </div>
      <form method="post" action="/espace/fermetures/retirer"
            data-confirmer="Rouvrir ${escape(periodeLisible(f.from, f.to))} ? Les rendez-vous redeviendront possibles.">
        ${cachees(
          aVenir.filter((_, j) => j !== i),
          0,
        )}
        ${cachees(passees, aVenir.length)}
        <button type="submit" class="danger" data-lent="Mise à jour…">Rouvrir ces dates</button>
      </form>
    </div>`;
          })
          .join("");

  return layoutClient(
    "Je ferme",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Je ferme</h1>
<p class="chapeau">
  Indiquez les jours où le salon est fermé. Les rendez-vous en ligne y sont
  bloqués immédiatement, et le site l'annonce à vos clients.
</p>

<form method="post" action="/espace/fermetures">
  ${cachees(aVenir, 0)}
  ${cachees(passees, aVenir.length)}

  <div class="fiche">
    <div class="fiche__titre">Nouvelle fermeture</div>

    <div class="actions" style="margin:0.9rem 0">
      <button type="button" class="second" data-raccourci="${escape(jour)}|${escape(jour)}">
        Aujourd'hui
      </button>
      <button type="button" class="second" data-raccourci="${escape(decale(1))}|${escape(decale(1))}">
        Demain
      </button>
      <button type="button" class="second" data-raccourci="${escape(jour)}|${escape(decale(6))}">
        Toute la semaine
      </button>
    </div>

    <label>Du
      <input type="date" name="closures.${aVenir.length + passees.length}.from"
             value="${escape(prerempli?.du ?? "")}" data-debut>
    </label>
    <label>Au <span class="aide">— laissez vide pour un seul jour</span>
      <input type="date" name="closures.${aVenir.length + passees.length}.to"
             value="${escape(prerempli?.au ?? "")}" data-fin>
    </label>
    <label>Motif <span class="aide">— facultatif, affiché sur le site</span>
      <input type="text" name="closures.${aVenir.length + passees.length}.reason.${escape(site.languages.default)}"
             placeholder="Congés annuels" maxlength="80">
    </label>
  </div>

  <div class="actions">
    <button type="submit" data-lent="Mise à jour du site…">Enregistrer et mettre en ligne</button>
  </div>
  <p class="aide">
    Comptez une minute : la réservation est bloquée tout de suite, le site
    s'actualise juste après.
  </p>
</form>

<h2>Mes fermetures</h2>
${liste}

${
  passees.length > 0
    ? `<h2>Déjà passées</h2>
${passees
  .map(
    (f) => `<div class="fiche">
    <div class="fiche__detail">${escape(periodeLisible(f.from, f.to))}</div>
  </div>`,
  )
  .join("")}`
    : ""
}`,
    { nomCommerce: site.business.name, retour: "/espace", script: true },
  );
}

export function espaceFermeturesRoutes(app: FastifyInstance): void {
  app.get("/espace/fermetures", async (request, reply) => {
    const slug = siteDuCommercant(utilisateur(request));
    await pull();
    return reply.type("text/html").send(page(slug));
  });

  const enregistrer = async (
    request: FastifyRequest<{ Body: Record<string, string> }>,
    reply: FastifyReply,
  ) => {
    const u = utilisateur(request);
    const slug = siteDuCommercant(u);
    const champs = (request.body ?? {}) as Champs;

    /*
     * Une date de fin antérieure au début est refusée ici plutôt que par le
     * schéma : le message du schéma parle de `closures.0.to`, celui-ci parle
     * au commerçant.
     */
    for (const cle of Object.keys(champs)) {
      const trouve = /^closures\.(\d+)\.from$/.exec(cle);
      if (!trouve) continue;
      const du = (champs[cle] ?? "").trim();
      const au = (champs[`closures.${trouve[1]}.to`] ?? "").trim();
      if (du && au && au < du) {
        return reply.code(400).type("text/html").send(
          page(slug, {
            ton: "ko",
            texte: `La date de fin (${dateLisible(au)}) est avant la date de début (${dateLisible(du)}).`,
          }),
        );
      }
    }

    const resultat = await enregistrerEtPublier(slug, u.id, "fermetures", champs);

    return reply.type("text/html").send(
      page(slug, {
        ton: resultat.ok ? "ok" : "ko",
        texte: resultat.ok ? "C'est fait. Vos fermetures sont en ligne." : resultat.message,
      }),
    );
  };

  app.post<{ Body: Record<string, string> }>("/espace/fermetures", enregistrer);

  // Retirer une fermeture emprunte le même chemin : le formulaire renvoie la
  // liste sans la ligne concernée. Une seule logique d'écriture, donc une seule
  // à vérifier.
  app.post<{ Body: Record<string, string> }>("/espace/fermetures/retirer", enregistrer);
}
