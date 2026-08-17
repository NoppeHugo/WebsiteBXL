import type { FastifyRequest } from "fastify";
import type { AdminUser } from "./db.ts";

/**
 * Qui est connecté, et ce qu'il a le droit de voir.
 *
 * Deux rôles, et un seul critère pour les distinguer : `tenant_slug`. Vide,
 * c'est l'exploitant, qui voit les trente commerces. Renseigné, c'est un
 * commerçant, qui ne voit que le sien.
 *
 * ─── Pourquoi un module à part ────────────────────────────────────────────
 *
 * Parce que la question « ce compte a-t-il le droit d'ouvrir ce site ? » doit
 * avoir **une seule** réponse dans tout le programme. Répétée dans quinze
 * routes, elle finit par être oubliée dans la seizième — et cet oubli-là ne
 * produit pas d'erreur : il donne au coiffeur d'en face l'accès au site du
 * salon voisin.
 */

export interface Utilisateur {
  id: number;
  email: string;
  /** Vide pour l'exploitant. */
  slug: string | null;
  motDePasseAChanger: boolean;
}

export function utilisateurDe(admin: AdminUser): Utilisateur {
  return {
    id: Number(admin.id),
    email: admin.email,
    slug: admin.tenant_slug,
    motDePasseAChanger: admin.must_change_password,
  };
}

/** L'utilisateur attaché à la requête par le crochet d'authentification. */
export function utilisateur(request: FastifyRequest): Utilisateur {
  const attache = (request as FastifyRequest & { utilisateur?: Utilisateur }).utilisateur;
  if (!attache) {
    // Ne devrait jamais arriver : le crochet global refuse toute requête non
    // authentifiée avant d'atteindre une route. Lever plutôt que renvoyer un
    // objet vide — une erreur bruyante vaut mieux qu'une autorisation muette.
    throw new Error("utilisateur absent de la requête");
  }
  return attache;
}

export function estExploitant(u: Utilisateur): boolean {
  return u.slug === null;
}

/**
 * Le site qu'un commerçant a le droit d'ouvrir.
 *
 * Lève pour l'exploitant : ses pages à lui reçoivent le slug par l'URL, et
 * confondre les deux chemins serait le début du mélange.
 */
export function siteDuCommercant(u: Utilisateur): string {
  if (u.slug === null) throw new Error("compte d'exploitation : aucun site attaché");
  return u.slug;
}
