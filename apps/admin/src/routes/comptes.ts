import { randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clients, client } from "../repo.ts";
import { config } from "../config.ts";
import { hashPassword } from "../auth.ts";
import { comptesClients, poserAccesClient, retirerAccesClient } from "../db.ts";
import { layout, flash, escape, depuis } from "../views.ts";

/**
 * Ouverture des accès commerçants, côté exploitant.
 *
 * ─── Le mot de passe est fabriqué ici, jamais choisi par l'exploitant ──────
 *
 * Un mot de passe choisi à la main pour un client se ressemble d'un client à
 * l'autre — le nom du salon, l'année, un point d'exclamation. Trente comptes
 * ainsi nommés se devinent tous à partir du premier. Celui-ci est tiré au sort,
 * affiché **une seule fois**, et le commerçant doit le remplacer à sa première
 * connexion.
 */

/*
 * Mots courants, faciles à dicter au téléphone et à retaper sans faute. Quatre
 * mots tirés parmi 64, plus deux chiffres, valent environ 30 bits — assez pour
 * un mot de passe qui ne vit que jusqu'à la première connexion, et infiniment
 * plus mémorisable que huit caractères aléatoires que le commerçant écrirait
 * sur un papier collé à la caisse.
 */
const MOTS = [
  "abricot", "alpage", "argile", "avoine", "balcon", "bambou", "bison", "bougie",
  "brique", "cabane", "cactus", "canard", "cerise", "chalet", "cigale", "citron",
  "colline", "comete", "coquille", "dauphin", "ecorce", "epaule", "erable", "etoile",
  "falaise", "fenetre", "figuier", "flocon", "fougere", "galet", "genevrier", "girafe",
  "grenade", "hameau", "hibou", "iguane", "jardin", "jonquille", "lagune", "lanterne",
  "lavande", "lezard", "lichen", "marais", "menthe", "mimosa", "narcisse", "nuage",
  "olivier", "orchidee", "ourson", "palmier", "pelican", "prairie", "quartz", "ruisseau",
  "sablier", "saphir", "sentier", "tortue", "trefle", "vanille", "verger", "zephyr",
] as const;

function motDePasseLisible(): string {
  const mots = Array.from({ length: 4 }, () => MOTS[randomInt(MOTS.length)]!);
  return `${mots.join("-")}-${randomInt(10, 100)}`;
}

interface Nouveau {
  slug: string;
  email: string;
  motDePasse: string;
}

async function page(
  message?: { kind: "ok" | "error"; text: string },
  nouveau?: Nouveau,
): Promise<string> {
  const comptes = await comptesClients();
  const parSlug = new Map(comptes.map((c) => [c.tenant_slug, c]));

  const lignes = clients()
    .map((slug) => {
      let nom = slug;
      try {
        nom = client(slug).site.business.name;
      } catch {
        // Un client au fichier illisible reste listé : c'est justement celui
        // dont on veut pouvoir couper l'accès.
      }
      const compte = parSlug.get(slug);

      return `<div class="carte" style="cursor:default">
  <div class="carte__titre">
    <b>${escape(nom)}</b>
    ${
      compte
        ? `<span class="badge" data-status="${compte.must_change_password ? "draft" : "live"}">${
            compte.must_change_password ? "Mot de passe à changer" : "Accès ouvert"
          }</span>`
        : `<span class="badge" data-status="suspended">Aucun accès</span>`
    }
  </div>
  ${
    compte
      ? `<div class="carte__ligne">${escape(compte.email)}</div>
         <div class="carte__ligne">Dernière connexion : ${escape(depuis(compte.last_login_at))}</div>
         <form method="post" action="/comptes/${escape(slug)}/retirer"
               data-confirmer="Retirer l'accès de ${escape(nom)} ? Il sera déconnecté immédiatement."
               style="margin-top:0.8rem">
           <button type="submit" class="secondary">Retirer l'accès</button>
         </form>
         <form method="post" action="/comptes/${escape(slug)}" style="margin-top:0.5rem">
           <input type="hidden" name="email" value="${escape(compte.email)}">
           <button type="submit" class="secondary">Nouveau mot de passe</button>
         </form>`
      : `<form method="post" action="/comptes/${escape(slug)}" style="margin-top:0.8rem">
           <label>Adresse e-mail du commerçant
             <input type="email" name="email" required placeholder="salon@exemple.be">
           </label>
           <div class="actions"><button type="submit">Ouvrir l'accès</button></div>
         </form>`
  }
</div>`;
    })
    .join("");

  return layout(
    "Accès des commerçants",
    `<h1>Accès des commerçants</h1>
<p class="intro">
  Chaque commerçant peut modifier lui-même ses horaires, ses fermetures, ses
  tarifs, ses photos et son texte — et rien d'autre.
  ${
    config.PORTAL_HOST
      ? `Il se connecte sur <b>${escape(config.PORTAL_HOST)}</b>.`
      : `<b>PORTAL_HOST n'est pas renseigné</b> : l'espace est servi sur cette
         même adresse, ce qui convient au développement mais pas à la
         clientèle.`
  }
</p>

${message ? flash(message.kind, message.text) : ""}

${
  nouveau
    ? `<div class="etat" data-etat="attente">
  <div class="etat__texte">
    <b>À remettre au commerçant, maintenant</b>
    <span>Ce mot de passe ne sera plus jamais affiché. Il devra le remplacer à
      sa première connexion.</span>
    <span style="margin-top:0.6rem;display:block">
      Adresse : <b>${escape(config.PORTAL_HOST || "cette console")}</b><br>
      Identifiant : <b>${escape(nouveau.email)}</b><br>
      Mot de passe : <b style="font-size:1.15rem;letter-spacing:0.02em">${escape(nouveau.motDePasse)}</b>
    </span>
  </div>
</div>`
    : ""
}

<div class="cartes">${lignes}</div>

<p style="margin-top:2rem"><a href="/clients">← Tous les clients</a></p>`,
    { authenticated: true, editeur: true },
  );
}

export function comptesRoutes(app: FastifyInstance): void {
  app.get("/comptes", async (_request, reply) =>
    reply.type("text/html").send(await page()),
  );

  app.post<{ Params: { slug: string }; Body: { email?: string } }>(
    "/comptes/:slug",
    async (request, reply) => {
      const { slug } = request.params;
      const email = (request.body?.email ?? "").trim();

      // Le site doit exister : ouvrir un accès à un dossier absent créerait un
      // compte qui plante à la première page, sans expliquer pourquoi.
      if (!clients().includes(slug)) {
        return reply
          .code(404)
          .type("text/html")
          .send(await page({ kind: "error", text: `Client « ${slug} » inconnu.` }));
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return reply
          .code(400)
          .type("text/html")
          .send(await page({ kind: "error", text: "Adresse e-mail invalide." }));
      }

      const motDePasse = motDePasseLisible();
      const pose = await poserAccesClient(email, slug, await hashPassword(motDePasse));
      if (!pose.ok) {
        return reply
          .code(409)
          .type("text/html")
          .send(await page({ kind: "error", text: pose.raison }));
      }

      return reply.type("text/html").send(
        await page(
          { kind: "ok", text: "Accès ouvert." },
          { slug, email, motDePasse },
        ),
      );
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/comptes/:slug/retirer",
    async (request, reply) => {
      await retirerAccesClient(request.params.slug);
      // La session du commerçant meurt à sa requête suivante : le compte est
      // relu en base à chaque page (voir le crochet d'authentification).
      return reply
        .type("text/html")
        .send(await page({ kind: "ok", text: "Accès retiré." }));
    },
  );
}
