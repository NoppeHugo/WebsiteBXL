import type { FastifyRequest } from "fastify";
import type { AdminUser } from "./db.ts";
import type { Eleve } from "./ecole.ts";

/**
 * Qui est connecté, et ce qu'il a le droit de voir.
 *
 * Quatre rôles, et un seul endroit qui les distingue :
 *
 *  - **l'exploitant**, qui voit les trente commerces ;
 *  - **le commerçant**, qui ne voit que le sien ;
 *  - **le responsable** d'une école, qui ne voit que ses élèves ;
 *  - **l'élève**, qui ne voit que ses exercices.
 *
 * ─── Pourquoi un module à part ────────────────────────────────────────────
 *
 * Parce que la question « ce compte a-t-il le droit d'ouvrir ceci ? » doit
 * avoir **une seule** réponse dans tout le programme. Répétée dans quinze
 * routes, elle finit par être oubliée dans la seizième — et cet oubli-là ne
 * produit pas d'erreur : il donne au coiffeur d'en face l'accès au site du
 * salon voisin, ou à un élève les copies de toute sa classe.
 *
 * ─── Pourquoi un champ `role` plutôt que trois tests de nullité ───────────
 *
 * Le rôle se lisait jusqu'ici dans la nullité de `tenant_slug` : vide,
 * l'exploitant. La règle tenait tant qu'il n'y avait que deux rôles ; un
 * troisième compte sans commerce attaché — le responsable d'école — serait
 * devenu exploitant par défaut, avec la main sur tous les sites clients. Le
 * rôle est donc calculé ici, une fois, et lu partout ailleurs.
 */

export type Role = "exploitant" | "commercant" | "responsable" | "eleve";

export interface Utilisateur {
  id: number;
  email: string;
  role: Role;
  /** Le commerce, pour un commerçant. Vide pour tous les autres. */
  slug: string | null;
  /** L'école, pour un responsable ou un élève. Vide pour les autres. */
  ecoleId: string | null;
  motDePasseAChanger: boolean;
}

export function utilisateurDe(admin: AdminUser): Utilisateur {
  return {
    id: Number(admin.id),
    email: admin.email,
    /*
     * L'ordre des tests est la règle elle-même. Un compte attaché à une école
     * est un responsable, même si quelque chose lui avait posé un commerce ;
     * l'exploitant est le seul cas qui reste après avoir écarté les deux
     * autres, et non le cas par défaut. La base interdit déjà les deux à la
     * fois (`admin_users_un_seul_role`) : c'est la seconde barrière.
     */
    role: admin.ecole_id !== null ? "responsable" : admin.tenant_slug !== null ? "commercant" : "exploitant",
    slug: admin.tenant_slug,
    ecoleId: admin.ecole_id,
    motDePasseAChanger: admin.must_change_password,
  };
}

/**
 * L'élève, converti dans la même monnaie que les comptes de la console.
 *
 * Il vient d'une autre table — c'est délibéré (voir la migration 011) — mais
 * traverse le programme sous le même type : le crochet d'authentification, la
 * lecture de session et les pages n'ont ainsi qu'une seule forme d'utilisateur
 * à connaître.
 */
export function utilisateurEleve(eleve: Eleve): Utilisateur {
  return {
    id: Number(eleve.id),
    email: eleve.email,
    role: "eleve",
    slug: null,
    ecoleId: eleve.ecole_id,
    // L'élève choisit son mot de passe lui-même en acceptant l'invitation :
    // aucun mot de passe ne lui est jamais remis, donc aucun à remplacer.
    motDePasseAChanger: false,
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
  return u.role === "exploitant";
}

/**
 * Le site qu'un commerçant a le droit d'ouvrir.
 *
 * Lève pour tout autre rôle : les pages de l'exploitant reçoivent le slug par
 * l'URL, et confondre les deux chemins serait le début du mélange.
 */
export function siteDuCommercant(u: Utilisateur): string {
  if (u.role !== "commercant" || u.slug === null) {
    throw new Error("ce compte n'a pas de commerce attaché");
  }
  return u.slug;
}

/**
 * L'école qu'un responsable a le droit d'administrer.
 *
 * C'est cette valeur, et elle seule, qui part dans les requêtes de
 * `db-ecole.ts`. Aucune page de l'espace de cours ne prend d'identifiant
 * d'école en paramètre : il n'y a donc rien à falsifier.
 */
export function ecoleDuResponsable(u: Utilisateur): number {
  if (u.role !== "responsable" || u.ecoleId === null) {
    throw new Error("ce compte n'administre aucune école");
  }
  return Number(u.ecoleId);
}

/** L'école dont un élève suit les cours. */
export function ecoleDeLEleve(u: Utilisateur): string {
  if (u.role !== "eleve" || u.ecoleId === null) {
    throw new Error("ce compte n'est pas celui d'un élève");
  }
  return u.ecoleId;
}
