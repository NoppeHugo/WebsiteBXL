import { describe, it, expect } from "vitest";
import type { FastifyRequest } from "fastify";
import type { AdminUser } from "./db.ts";
import { utilisateurDe, estExploitant, siteDuCommercant, utilisateur } from "./acces.ts";

/**
 * Le cloisonnement entre commerçants.
 *
 * Ces tests portent sur quatre fonctions triviales, et c'est voulu : elles sont
 * le seul endroit du programme qui décide qui voit quoi. Leur simplicité est ce
 * qui rend la règle vérifiable — et une régression ici ne produirait aucune
 * erreur, seulement le site du salon voisin dans les mains du mauvais coiffeur.
 */

const compte = (surcharge: Partial<AdminUser> = {}): AdminUser => ({
  id: "7",
  email: "salon@exemple.be",
  password_hash: "scrypt$x$y",
  totp_secret: null,
  tenant_slug: "salon-marie",
  must_change_password: false,
  ...surcharge,
});

describe("utilisateurDe", () => {
  it("distingue l'exploitant du commerçant par le seul champ qui les sépare", () => {
    expect(estExploitant(utilisateurDe(compte({ tenant_slug: null })))).toBe(true);
    expect(estExploitant(utilisateurDe(compte()))).toBe(false);
  });

  it("convertit l'identifiant en nombre", () => {
    // Le pilote Postgres renvoie les bigserial en chaîne. Un identifiant resté
    // texte finirait dans `publish_log.admin_id` et casserait la jointure.
    expect(utilisateurDe(compte({ id: "42" })).id).toBe(42);
  });

  it("retient qu'un mot de passe remis doit être remplacé", () => {
    expect(utilisateurDe(compte({ must_change_password: true })).motDePasseAChanger).toBe(true);
  });
});

describe("siteDuCommercant", () => {
  it("rend le site attaché au compte", () => {
    expect(siteDuCommercant(utilisateurDe(compte()))).toBe("salon-marie");
  });

  it("refuse de rendre un site pour un compte d'exploitation", () => {
    /*
     * L'exploitant n'a pas de commerce attaché. Renvoyer une chaîne vide, ou
     * le premier client venu, ouvrirait ses pages sur un site arbitraire —
     * qu'il modifierait en croyant modifier autre chose. Lever est la seule
     * réponse honnête.
     */
    expect(() => siteDuCommercant(utilisateurDe(compte({ tenant_slug: null })))).toThrow();
  });
});

describe("utilisateur", () => {
  it("lève si le crochet d'authentification n'a rien attaché", () => {
    /*
     * Ne devrait jamais arriver — mais si cela arrivait, l'alternative serait
     * de renvoyer un objet vide, donc un `slug` nul, donc une page servie sans
     * savoir à qui. Une erreur bruyante vaut mieux qu'une autorisation muette.
     */
    expect(() => utilisateur({} as FastifyRequest)).toThrow();
  });

  it("rend l'utilisateur attaché à la requête", () => {
    const u = utilisateurDe(compte());
    expect(utilisateur({ utilisateur: u } as unknown as FastifyRequest)).toBe(u);
  });
});
