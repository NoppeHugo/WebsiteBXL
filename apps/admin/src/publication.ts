import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { client, readSiteRaw, writeSite, commitAndPush, publish, pull } from "./repo.ts";
import { config } from "./config.ts";
import { projeterCommerce } from "./tenant.ts";
import { logPublish } from "./db.ts";
import { appliquerSection, type Champs, type Section } from "./contenu.ts";

/**
 * Enregistrer et mettre en ligne, en un seul geste.
 *
 * ─── Pourquoi un seul geste ────────────────────────────────────────────────
 *
 * La console de l'exploitant sépare « Enregistrer » et « Mettre en ligne », et
 * c'est justifié chez lui : il prépare un site, y revient, le montre, puis le
 * publie quand il est prêt.
 *
 * Un commerçant, non. Il ferme jeudi, il l'écrit, il veut que ce soit vrai. Lui
 * demander de comprendre qu'un enregistrement ne change rien au site public,
 * c'est garantir qu'un jour il fermera sans que le site le dise — et son client
 * se déplacera pour rien.
 *
 * ─── L'ordre des opérations est la partie importante ───────────────────────
 *
 * La base d'abord, le site ensuite.
 *
 * La base commande la réservation : dès qu'elle est à jour, plus aucun
 * rendez-vous n'est accepté sur un créneau fermé. Le site reconstruit, lui,
 * n'est qu'un affichage. Si la construction échoue — dépendance cassée, disque
 * plein, hôte injoignable — le commerçant garde un site qui affiche l'ancien
 * horaire, ce qui est fâcheux, mais **plus personne ne peut réserver ce
 * jour-là**, ce qui est l'essentiel.
 *
 * L'ordre inverse aurait produit exactement la panne qu'on cherche à éviter :
 * un site annonçant la fermeture pendant que l'agenda continue d'accepter.
 */

export interface ResultatEnregistrement {
  ok: boolean;
  /** Message destiné au commerçant, en clair. */
  message: string;
  /** Vrai si la base a été mise à jour, même en cas d'échec ultérieur. */
  reservationAJour: boolean;
}

export async function enregistrerEtPublier(
  slug: string,
  adminId: number,
  section: Section,
  champs: Champs,
  { publier = true } = {},
): Promise<ResultatEnregistrement> {
  // Le dépôt peut avoir bougé : l'exploitant vient peut-être de modifier le
  // même site depuis sa console.
  await pull();

  const raw = readSiteRaw(slug);
  appliquerSection(raw, section, champs);

  const ecrit = writeSite(slug, raw);
  if (!ecrit.ok) {
    return {
      ok: false,
      reservationAJour: false,
      message: `Non enregistré : ${ecrit.errors.join(" · ")}`,
    };
  }

  // 1. La base : effet immédiat sur la réservation.
  const base = await projeterCommerce(client(slug).site);
  if (!base.ok) {
    return {
      ok: false,
      reservationAJour: false,
      message: `Enregistré, mais la réservation n'a pas suivi : ${base.message}`,
    };
  }

  // 2. Git : l'historique, et la source de vérité du contenu.
  const pousse = await commitAndPush(slug, `espace client(${slug}) : ${section}`);
  await logPublish(adminId, slug, "save", `espace client : ${section}`);
  if (!pousse.ok) {
    return {
      ok: false,
      reservationAJour: true,
      message:
        "Vos modifications sont prises en compte pour les rendez-vous, mais" +
        " leur enregistrement définitif a échoué. Prévenez votre prestataire.",
    };
  }

  if (!publier) {
    return { ok: true, reservationAJour: true, message: "Enregistré." };
  }

  // 3. Le site public.
  const misEnLigne = await publish(slug);
  await logPublish(adminId, slug, "publish", misEnLigne.output.slice(0, 1000));
  if (!misEnLigne.ok) {
    return {
      ok: false,
      reservationAJour: true,
      message:
        "Vos modifications sont enregistrées et déjà prises en compte pour les" +
        " rendez-vous, mais le site public n'a pas pu être mis à jour." +
        " Prévenez votre prestataire — rien n'est perdu.",
    };
  }

  return { ok: true, reservationAJour: true, message: "C'est en ligne." };
}

/**
 * Changer le style et la couleur, puis mettre en ligne.
 *
 * Même geste unique que pour le contenu, à une différence près : le thème ne
 * touche pas à la base. Ni les horaires, ni les prestations, ni les fermetures
 * n'en dépendent — la projection n'aurait rien à reporter, et l'appeler pour
 * rien ferait croire qu'elle a sa part dans l'affaire.
 */
export async function publierApparence(
  slug: string,
  adminId: number,
  theme: unknown,
): Promise<ResultatEnregistrement> {
  await pull();

  writeFileSync(
    join(config.REPO_PATH, "clients", slug, "theme.json"),
    `${JSON.stringify(theme, null, 2)}\n`,
  );

  const pousse = await commitAndPush(slug, `espace client(${slug}) : apparence`);
  await logPublish(adminId, slug, "save", "espace client : apparence");
  if (!pousse.ok) {
    return {
      ok: false,
      reservationAJour: true,
      message:
        "Votre nouveau style est enregistré sur le serveur, mais son" +
        " enregistrement définitif a échoué. Prévenez votre prestataire.",
    };
  }

  const misEnLigne = await publish(slug);
  await logPublish(adminId, slug, "publish", misEnLigne.output.slice(0, 1000));
  if (!misEnLigne.ok) {
    return {
      ok: false,
      reservationAJour: true,
      message:
        "Votre nouveau style est enregistré, mais le site public n'a pas pu" +
        " être mis à jour. Prévenez votre prestataire — rien n'est perdu.",
    };
  }

  return { ok: true, reservationAJour: true, message: "Votre site a changé d'allure." };
}
