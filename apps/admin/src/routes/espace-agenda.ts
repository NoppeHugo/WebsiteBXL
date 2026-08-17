import type { FastifyInstance } from "fastify";
import { cancelledByBusiness } from "@bxl/api/appointment-notices";
import { client } from "../repo.ts";
import { rendezVousDuCommerce, annulerRendezVous, messagesDuCommerce } from "../db.ts";
import { utilisateur, siteDuCommercant } from "../acces.ts";
import { layoutClient, message } from "../views-client.ts";
import { escape } from "../views.ts";
import { sendMail } from "../mail.ts";

/**
 * Rendez-vous et messages reçus.
 *
 * En lecture, à une exception près : annuler. C'est la seule action que le
 * salon doit pouvoir faire lui-même et tout de suite — un imprévu, et il faut
 * prévenir la personne avant qu'elle se déplace.
 *
 * L'annulation envoie le courriel au client final dans la foulée. Sans lui,
 * l'annulation ne serait qu'une ligne effacée d'un écran que le client ne voit
 * pas : il se présenterait quand même.
 */

const HEURE = new Intl.DateTimeFormat("fr-BE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Brussels",
});

const QUAND = new Intl.DateTimeFormat("fr-BE", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Brussels",
});

async function pageRendezVous(
  slug: string,
  flash?: { ton: "ok" | "ko"; texte: string },
): Promise<string> {
  const { site } = client(slug);
  const rdv = await rendezVousDuCommerce(slug);

  const liste =
    rdv.length === 0
      ? `<p class="vide">Aucun rendez-vous à venir.</p>`
      : rdv
          .map(
            (r) => `<div class="fiche">
  <div class="fiche__titre">${escape(HEURE.format(new Date(r.debut)))}</div>
  <div class="fiche__detail">
    ${escape(r.customer_name)} · ${escape(r.service_name)}
    ${r.resource_name ? ` · avec ${escape(r.resource_name)}` : ""}
  </div>
  <div class="fiche__detail">
    <a href="tel:${escape(r.customer_phone ?? "")}">${escape(r.customer_phone ?? "")}</a>
    ${r.customer_phone ? " · " : ""}
    <a href="mailto:${escape(r.customer_email)}">${escape(r.customer_email)}</a>
  </div>
  ${r.note ? `<div class="fiche__detail">« ${escape(r.note)} »</div>` : ""}
  <form method="post" action="/espace/rendez-vous/annuler"
        data-confirmer="Annuler le rendez-vous de ${escape(r.customer_name)} ? Un courriel lui sera envoyé.">
    <input type="hidden" name="id" value="${escape(r.id)}">
    <button type="submit" class="danger" data-lent="Annulation…">Annuler ce rendez-vous</button>
  </form>
</div>`,
          )
          .join("");

  return layoutClient(
    "Mes rendez-vous",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mes rendez-vous</h1>
<p class="chapeau">Ce qui est réservé en ligne, du plus proche au plus lointain.</p>
${liste}
<p class="aide">
  Annuler prévient la personne par courriel et libère le créneau. Pour fermer
  une journée entière, passez par <a href="/espace/fermetures">Je ferme</a>.
</p>`,
    { nomCommerce: site.business.name, retour: "/espace", script: true },
  );
}

async function pageMessages(slug: string): Promise<string> {
  const { site } = client(slug);
  const messages = await messagesDuCommerce(slug);

  const liste =
    messages.length === 0
      ? `<p class="vide">Aucun message reçu.</p>`
      : messages
          .map(
            (m) => `<div class="fiche">
  <div class="fiche__titre">${escape(m.customer_name)}</div>
  <div class="fiche__detail">
    ${escape(QUAND.format(new Date(m.created_at)))} ·
    <a href="mailto:${escape(m.customer_email)}">${escape(m.customer_email)}</a>
  </div>
  <p style="margin:0.7rem 0 0">${escape(m.message)}</p>
  <form action="mailto:${escape(m.customer_email)}" method="get">
    <button type="submit" class="second">Répondre</button>
  </form>
</div>`,
          )
          .join("");

  return layoutClient(
    "Mes messages",
    `<h1>Mes messages</h1>
<p class="chapeau">
  Ce que vos clients vous ont écrit depuis le site. Ils vous sont aussi envoyés
  par courriel au moment où ils arrivent.
</p>
${liste}`,
    { nomCommerce: site.business.name, retour: "/espace" },
  );
}

export function espaceAgendaRoutes(app: FastifyInstance): void {
  app.get("/espace/rendez-vous", async (request, reply) =>
    reply
      .type("text/html")
      .send(await pageRendezVous(siteDuCommercant(utilisateur(request)))),
  );

  app.post<{ Body: { id?: string } }>(
    "/espace/rendez-vous/annuler",
    async (request, reply) => {
      const slug = siteDuCommercant(utilisateur(request));
      const id = (request.body?.id ?? "").trim();

      /*
       * Le `slug` fait partie de la condition de mise à jour, il n'est pas
       * vérifié à part : un identifiant appartenant à un autre salon ne trouve
       * simplement aucune ligne. Impossible d'annuler le rendez-vous du voisin,
       * même en fabriquant la requête.
       */
      const annule = await annulerRendezVous(slug, id);
      if (!annule) {
        return reply.code(404).type("text/html").send(
          await pageRendezVous(slug, {
            ton: "ko",
            texte: "Ce rendez-vous n'existe plus, ou il était déjà annulé.",
          }),
        );
      }

      const { site } = client(slug);
      const langue = site.languages.default;
      let texte = `Rendez-vous annulé. ${annule.customer_name} a été prévenu par courriel.`;
      try {
        await sendMail(
          cancelledByBusiness({
            customerName: annule.customer_name,
            customerEmail: annule.customer_email,
            businessName: site.business.name,
            businessPhone: site.business.phone,
            serviceName: annule.service_name,
            when: new Intl.DateTimeFormat(`${langue}-BE`, {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: "Europe/Brussels",
            }).format(new Date(annule.debut)),
            locale: langue,
          }),
        );
      } catch (erreur) {
        // Le créneau est libéré quoi qu'il arrive : c'est l'essentiel, et le
        // dire vaut mieux que laisser croire que la personne est prévenue.
        request.log.error({ err: erreur }, "avis d'annulation non envoyé");
        texte =
          `Rendez-vous annulé, mais le courriel n'a pas pu partir. ` +
          `Prévenez ${annule.customer_name} au ${annule.customer_phone ?? annule.customer_email}.`;
      }

      return reply
        .type("text/html")
        .send(await pageRendezVous(slug, { ton: "ok", texte }));
    },
  );

  app.get("/espace/messages", async (request, reply) =>
    reply.type("text/html").send(await pageMessages(siteDuCommercant(utilisateur(request)))),
  );
}
