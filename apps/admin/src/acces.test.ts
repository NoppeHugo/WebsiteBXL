import { describe, it, expect } from "vitest";
import type { FastifyRequest } from "fastify";
import type { AdminUser } from "./db.ts";
import type { Eleve } from "./ecole.ts";
import {
  utilisateurDe,
  utilisateurEleve,
  estExploitant,
  siteDuCommercant,
  ecoleDuResponsable,
  ecoleDeLEleve,
  utilisateur,
} from "./acces.ts";

/**
 * Le cloisonnement entre commerçants, entre écoles, et entre les deux.
 *
 * Ces tests portent sur des fonctions triviales, et c'est voulu : elles sont le
 * seul endroit du programme qui décide qui voit quoi. Leur simplicité est ce
 * qui rend la règle vérifiable — et une régression ici ne produirait aucune
 * erreur, seulement le site du salon voisin dans les mains du mauvais coiffeur,
 * ou les copies d'une classe dans celles d'un élève.
 */

const compte = (surcharge: Partial<AdminUser> = {}): AdminUser => ({
  id: "7",
  email: "salon@exemple.be",
  password_hash: "scrypt$x$y",
  totp_secret: null,
  tenant_slug: "salon-marie",
  ecole_id: null,
  must_change_password: false,
  ...surcharge,
});

const eleve = (surcharge: Partial<Eleve> = {}): Eleve => ({
  id: "12",
  ecole_id: "3",
  email: "sofia@exemple.be",
  prenom: "Sofia",
  nom: "Mertens",
  password_hash: "scrypt$x$y",
  invitation: null,
  invitation_fin: null,
  actif_le: new Date(),
  last_login_at: null,
  created_at: new Date(),
  ...surcharge,
});

describe("utilisateurDe", () => {
  it("distingue l'exploitant du commerçant par le seul champ qui les sépare", () => {
    expect(estExploitant(utilisateurDe(compte({ tenant_slug: null })))).toBe(true);
    expect(estExploitant(utilisateurDe(compte()))).toBe(false);
  });

  it("ne fait pas d'un responsable d'école un exploitant", () => {
    /*
     * Le test qui compte le plus de ce fichier.
     *
     * Le rôle se lisait dans la nullité de `tenant_slug` : un compte sans
     * commerce était l'exploitant. Le responsable d'une école n'a pas de
     * commerce non plus — et l'inscription à l'espace de cours est libre.
     * Sans ce départage, n'importe qui ouvrait un compte d'école et se
     * retrouvait avec la console qui met les trente sites hors ligne.
     */
    const u = utilisateurDe(compte({ tenant_slug: null, ecole_id: "3" }));
    expect(u.role).toBe("responsable");
    expect(estExploitant(u)).toBe(false);
    expect(() => siteDuCommercant(u)).toThrow();
    expect(ecoleDuResponsable(u)).toBe(3);
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

describe("utilisateurEleve", () => {
  it("range l'élève dans son rôle, et dans son école", () => {
    const u = utilisateurEleve(eleve());
    expect(u.role).toBe("eleve");
    expect(ecoleDeLEleve(u)).toBe("3");
    expect(u.id).toBe(12);
  });

  it("ne donne à l'élève ni commerce, ni console, ni école à administrer", () => {
    /*
     * Un élève est un compte comme un autre pour le crochet
     * d'authentification : c'est ici, et seulement ici, qu'il est établi qu'il
     * ne peut rien administrer. La table des élèves est distincte de celle des
     * comptes de console pour la même raison, mais deux barrières valent mieux
     * qu'une sur une question pareille.
     */
    const u = utilisateurEleve(eleve());
    expect(estExploitant(u)).toBe(false);
    expect(() => siteDuCommercant(u)).toThrow();
    expect(() => ecoleDuResponsable(u)).toThrow();
  });

  it("n'impose jamais de changement de mot de passe", () => {
    // Personne ne lui en remet un : il le choisit en acceptant l'invitation.
    expect(utilisateurEleve(eleve()).motDePasseAChanger).toBe(false);
  });
});

describe("ecoleDuResponsable", () => {
  it("refuse de rendre une école pour un commerçant ou pour l'exploitant", () => {
    expect(() => ecoleDuResponsable(utilisateurDe(compte()))).toThrow();
    expect(() => ecoleDuResponsable(utilisateurDe(compte({ tenant_slug: null })))).toThrow();
  });

  it("convertit l'identifiant en nombre", () => {
    // Le pilote Postgres renvoie les bigserial en chaîne ; les requêtes de
    // `db-ecole.ts` attendent un nombre.
    expect(ecoleDuResponsable(utilisateurDe(compte({ tenant_slug: null, ecole_id: "41" })))).toBe(41);
  });
});
