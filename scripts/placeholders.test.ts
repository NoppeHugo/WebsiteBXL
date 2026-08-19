import { describe, expect, it } from "vitest";
import { METIERS } from "../packages/schema/src/metiers.ts";
import { MOTIFS, defaultSpecs } from "./gen-placeholders.ts";

/**
 * Les visuels de remplacement.
 *
 * Ils comptent plus qu'il n'y paraît : c'est ce que le commerçant voit le jour
 * de la signature, avant d'avoir fourni la moindre photo. Un fût de barbier
 * sur le site d'un fleuriste ne fait pas seulement tache — il lui dit qu'on
 * lui sert le site d'un autre, et il a raison.
 *
 * Les motifs étaient décrits deux fois : dans `metiers.ts` et dans le script
 * qui les dessine. Les deux listes avaient divergé sans que rien ne le
 * signale, parce qu'un motif inconnu ne casse rien — il sort un dégradé nu.
 * `metiers.ts` décide seul, désormais, et ces tests le vérifient.
 */

describe("motifs des métiers", () => {
  it("ne réclame que des motifs que le script sait dessiner", () => {
    const connus = new Set<string>(MOTIFS);
    for (const metier of Object.values(METIERS)) {
      for (const motif of [metier.motifs.hero, ...metier.motifs.galerie, metier.motifs.portrait]) {
        expect(connus.has(motif), `${metier.id} : motif inconnu « ${motif} »`).toBe(true);
      }
    }
  });

  it("donne six motifs de galerie à chaque métier", () => {
    // Le jeu standard compte six photos de galerie : une liste plus courte
    // laisserait des emplacements sans motif, donc des aplats nus au milieu
    // d'une galerie qui en a.
    for (const metier of Object.values(METIERS)) {
      expect(metier.motifs.galerie.length, metier.id).toBe(6);
    }
  });

  it("garde les portraits d'équipe en silhouette", () => {
    /*
     * Aucun visuel ne représente une personne identifiable. Une silhouette
     * suffit à faire lire « portrait » à l'emplacement d'un portrait ; y
     * ajouter des traits donnerait un personnage, donc une identité, donc une
     * question à laquelle on n'a pas de réponse.
     */
    for (const metier of Object.values(METIERS)) {
      expect(metier.motifs.portrait, metier.id).toBe("silhouette");
    }
  });

  it("dessine bien ce que le métier déclare", () => {
    // Le script lit `metiers.ts` : ce test attrape le jour où quelqu'un y
    // remettrait une table à lui, ce qui a déjà eu lieu une fois.
    for (const metier of Object.values(METIERS)) {
      const specs = defaultSpecs(metier.id);
      expect(specs).toHaveLength(10);
      expect(specs[0]!.motif, `${metier.id} : hero`).toBe(metier.motifs.hero);
      expect(specs.slice(1, 7).map((s) => s.motif), `${metier.id} : galerie`).toEqual([
        ...metier.motifs.galerie,
      ]);
      for (const portrait of specs.slice(7)) {
        expect(portrait.motif, `${metier.id} : portrait`).toBe(metier.motifs.portrait);
      }
    }
  });

  it("retombe sur les soins pour un métier inconnu, plutôt que sur rien", () => {
    // Mieux vaut des ciseaux qu'un dégradé vide : le second se lit comme un
    // site inachevé, et c'est ce qu'on cherche justement à éviter.
    expect(defaultSpecs("metier-qui-nexiste-pas")[0]!.motif).toBe(METIERS.soins!.motifs.hero);
  });
});
