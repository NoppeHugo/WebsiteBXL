import type { FastifyInstance } from "fastify";
import { client } from "../repo.ts";
import { commandesDuCommerce, changerEtatCommande } from "../db.ts";
import { utilisateur, siteDuCommercant } from "../acces.ts";
import { layoutClient, message, dateLisible } from "../views-client.ts";
import { escape } from "../views.ts";

/**
 * Les commandes reçues, côté commerçant.
 *
 * Ce que « Mes rendez-vous » est à un coiffeur. La différence tient en une
 * ligne : un rendez-vous est déjà pris, une commande est une intention. Le
 * fleuriste rappelle, s'accorde sur ce qu'il peut composer, puis marque la
 * commande confirmée.
 *
 * D'où trois états et non deux : à traiter, confirmée, faite. Sans « à
 * traiter » distinct, une commande arrivée le samedi soir se perdrait dans la
 * liste de celles qui sont déjà réglées.
 */

const RECU = new Intl.DateTimeFormat("fr-BE", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Brussels",
});

async function page(
  slug: string,
  flash?: { ton: "ok" | "ko"; texte: string },
): Promise<string> {
  const { site } = client(slug);
  const commandes = await commandesDuCommerce(slug);

  const liste =
    commandes.length === 0
      ? `<p class="vide">Aucune commande en attente.</p>`
      : commandes
          .map((c) => {
            const quand = c.wanted_day ? dateLisible(c.wanted_day) : "dès que possible";
            const aTraiter = c.status === "new";

            return `<div class="fiche">
  <div class="fiche__titre">
    ${escape(quand)}${aTraiter ? ` <span class="marque-neuf">à traiter</span>` : ""}
  </div>
  <div class="fiche__detail">
    ${escape(c.customer_name)}
    ${c.occasion_name ? ` · ${escape(c.occasion_name)}` : ""}
    ${c.budget_cents !== null ? ` · budget ${Math.round(c.budget_cents / 100)} €` : ""}
  </div>
  <div class="fiche__detail">
    ${c.mode === "delivery" ? `Livraison — ${escape(c.address ?? "")}` : "Retrait en boutique"}
  </div>
  <div class="fiche__detail">
    ${c.customer_phone ? `<a href="tel:${escape(c.customer_phone)}">${escape(c.customer_phone)}</a> · ` : ""}
    <a href="mailto:${escape(c.customer_email)}">${escape(c.customer_email)}</a>
  </div>
  ${
    c.card_message
      ? `<p class="fiche__carte">Mot pour la carte, à recopier tel quel :<br>
         « ${escape(c.card_message)} »</p>`
      : ""
  }
  ${c.note ? `<div class="fiche__detail">« ${escape(c.note)} »</div>` : ""}
  <div class="fiche__detail" style="margin-top:0.5rem">Reçue le ${escape(RECU.format(new Date(c.created_at)))}</div>

  <div class="actions actions--rangee" style="margin-top:0.9rem">
    ${
      aTraiter
        ? `<form method="post" action="/espace/commandes/etat">
             <input type="hidden" name="id" value="${escape(c.id)}">
             <input type="hidden" name="etat" value="confirmed">
             <button type="submit" data-lent="…">Confirmée</button>
           </form>`
        : `<form method="post" action="/espace/commandes/etat">
             <input type="hidden" name="id" value="${escape(c.id)}">
             <input type="hidden" name="etat" value="done">
             <button type="submit" data-lent="…">Livrée</button>
           </form>`
    }
    <form method="post" action="/espace/commandes/etat"
          data-confirmer="Retirer la commande de ${escape(c.customer_name)} ? Prévenez-le d'abord.">
      <input type="hidden" name="id" value="${escape(c.id)}">
      <input type="hidden" name="etat" value="declined">
      <button type="submit" class="danger" data-lent="…">Annulée</button>
    </form>
  </div>
</div>`;
          })
          .join("");

  return layoutClient(
    "Mes commandes",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mes commandes</h1>
<p class="chapeau">
  Les demandes reçues par le site, la plus urgente en haut. Rien n'a été payé :
  appelez le client pour vous accorder sur ce que vous pouvez composer.
</p>
${liste}`,
    { nomCommerce: site.business.name, retour: "/espace", script: true },
  );
}

export function espaceCommandesRoutes(app: FastifyInstance): void {
  app.get("/espace/commandes", async (request, reply) =>
    reply
      .type("text/html")
      .send(await page(siteDuCommercant(utilisateur(request)))),
  );

  app.post<{ Body: { id?: string; etat?: string } }>(
    "/espace/commandes/etat",
    async (request, reply) => {
      const slug = siteDuCommercant(utilisateur(request));
      const id = (request.body?.id ?? "").trim();
      const etat = request.body?.etat ?? "";

      if (etat !== "confirmed" && etat !== "declined" && etat !== "done") {
        return reply
          .code(400)
          .type("text/html")
          .send(await page(slug, { ton: "ko", texte: "État inconnu." }));
      }

      // Le `slug` est dans la condition de mise à jour : une commande d'un
      // autre commerce ne trouve simplement aucune ligne.
      const fait = await changerEtatCommande(slug, id, etat);
      const dit = {
        confirmed: "Commande confirmée.",
        done: "Commande marquée livrée.",
        declined: "Commande annulée.",
      }[etat];

      return reply.type("text/html").send(
        await page(slug, {
          ton: fait ? "ok" : "ko",
          texte: fait ? dit : "Cette commande n'existe plus.",
        }),
      );
    },
  );
}
