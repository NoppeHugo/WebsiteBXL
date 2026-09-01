import { describe, it, expect } from "vitest";
import {
  BAREME,
  hautsFaits,
  niveauDe,
  nouveauxHautsFaits,
  points,
  semaine,
  serie,
  veille,
  type StatsEleve,
} from "./jeu.ts";

/**
 * Le jeu est ce qui fait revenir un élève un mercredi soir. Une série fausse
 * une seule fois, et il n'y croit plus jamais — c'est le seul de ces calculs
 * qui ne se rattrape pas.
 */

const stats = (surcharge: Partial<StatsEleve> = {}): StatsEleve => ({
  rendus: 0,
  acquis: 0,
  aLHeure: 0,
  total: 10,
  jours: [],
  ...surcharge,
});

describe("points", () => {
  it("additionne les trois gestes qui comptent", () => {
    expect(points({ rendus: 3, acquis: 2, aLHeure: 1 })).toBe(
      3 * BAREME.rendu + 2 * BAREME.acquis + 1 * BAREME.aLHeure,
    );
  });

  it("ne donne rien à qui n'a rien rendu", () => {
    // Aucun point pour s'être connecté : un jeu qui récompense la présence
    // apprend à venir sans travailler.
    expect(points({ rendus: 0, acquis: 0, aLHeure: 0 })).toBe(0);
  });
});

describe("niveauDe", () => {
  it("place au premier palier tant que rien n'est gagné", () => {
    const n = niveauDe(0);
    expect(n.rang).toBe(1);
    expect(n.nom).toBe("Premiers pas");
    expect(n.suivant?.nom).toBe("En route");
  });

  it("monte au palier atteint, jamais au suivant", () => {
    expect(niveauDe(59).rang).toBe(1);
    expect(niveauDe(60).rang).toBe(2);
    expect(niveauDe(149).rang).toBe(2);
    expect(niveauDe(150).rang).toBe(3);
  });

  it("remplit la barre au dernier palier", () => {
    /*
     * Une barre à moitié pleine faute de palier au-dessus donnerait
     * l'impression d'un travail inachevé à celui qui a tout fait.
     */
    const n = niveauDe(5000);
    expect(n.suivant).toBeNull();
    expect(n.pourcentage).toBe(100);
    expect(n.restant).toBe(0);
  });

  it("dit ce qu'il reste à gagner, exactement", () => {
    const n = niveauDe(100);
    expect(n.restant).toBe(50);
    // 40 points parcourus sur les 90 qui séparent 60 de 150.
    expect(n.pourcentage).toBe(44);
  });
});

describe("serie", () => {
  it("compte les jours consécutifs", () => {
    expect(serie(["2026-03-10", "2026-03-11", "2026-03-12"], "2026-03-12")).toBe(3);
  });

  it("survit à la journée en cours tant qu'elle n'est pas finie", () => {
    /*
     * Le test qui compte. Une série tombée à zéro dès minuit obligerait à
     * ouvrir l'application chaque matin pour ne pas « perdre » — c'est ce qui
     * rend les applications de langues détestables, et ça produit du passage,
     * pas du travail. On a la journée entière pour la tenir.
     */
    expect(serie(["2026-03-10", "2026-03-11"], "2026-03-12")).toBe(2);
  });

  it("tombe après un jour réellement manqué", () => {
    expect(serie(["2026-03-10", "2026-03-11"], "2026-03-13")).toBe(0);
  });

  it("ignore un vieux bloc de jours sans rapport", () => {
    expect(serie(["2026-01-01", "2026-01-02", "2026-03-12"], "2026-03-12")).toBe(1);
  });

  it("rend zéro pour un élève qui n'a jamais rien rendu", () => {
    expect(serie([], "2026-03-12")).toBe(0);
  });

  it("traverse un changement d'heure sans se casser", () => {
    // Le dernier dimanche de mars, la Belgique passe à l'heure d'été. Une
    // soustraction de 24 heures sur une date locale sauterait ou répéterait un
    // jour ; l'arithmétique se fait donc à midi UTC.
    expect(veille("2026-03-30")).toBe("2026-03-29");
    expect(serie(["2026-03-28", "2026-03-29", "2026-03-30"], "2026-03-30")).toBe(3);
  });
});

describe("semaine", () => {
  it("rend sept jours, du plus ancien à aujourd'hui", () => {
    const s = semaine(["2026-03-12"], "2026-03-12");
    expect(s).toHaveLength(7);
    expect(s[0]!.jour).toBe("2026-03-06");
    expect(s[6]!.jour).toBe("2026-03-12");
    expect(s[6]!.aujourdhui).toBe(true);
    expect(s[6]!.actif).toBe(true);
    expect(s[0]!.actif).toBe(false);
  });
});

describe("hautsFaits", () => {
  it("montre tout, obtenu ou non, avec ce qui manque", () => {
    /*
     * Un haut fait secret ne se découvre qu'une fois décroché, c'est-à-dire
     * quand il ne sert plus à rien. « 3 sur 5 » est une invitation.
     */
    const faits = hautsFaits(stats({ rendus: 3 }), 0);
    const cinq = faits.find((h) => h.id === "cinq")!;
    expect(cinq.obtenu).toBe(false);
    expect(cinq.fait).toBe(3);
    expect(cinq.requis).toBe(5);
  });

  it("accorde le premier pas dès le premier exercice rendu", () => {
    expect(hautsFaits(stats({ rendus: 1 }), 0).find((h) => h.id === "depart")!.obtenu).toBe(true);
  });

  it("n'accorde rien d'office quand l'école n'a rien publié", () => {
    // « Tout le programme » sur un programme vide serait un haut fait donné
    // pour rien, et le premier que l'élève cesserait de croire.
    const faits = hautsFaits(stats({ total: 0, rendus: 0 }), 0);
    expect(faits.find((h) => h.id === "programme")!.obtenu).toBe(false);
  });

  it("accorde le programme quand tout est rendu", () => {
    const faits = hautsFaits(stats({ total: 4, rendus: 4 }), 0);
    expect(faits.find((h) => h.id === "programme")!.obtenu).toBe(true);
  });

  it("suit la série pour les hauts faits de régularité", () => {
    const faits = hautsFaits(stats(), 7);
    expect(faits.find((h) => h.id === "serie3")!.obtenu).toBe(true);
    expect(faits.find((h) => h.id === "serie7")!.obtenu).toBe(true);
  });
});

describe("nouveauxHautsFaits", () => {
  it("ne rend que ce qui vient d'être décroché", () => {
    const avant = hautsFaits(stats({ rendus: 4 }), 0);
    const apres = hautsFaits(stats({ rendus: 5 }), 0);
    expect(nouveauxHautsFaits(avant, apres).map((h) => h.id)).toEqual(["cinq"]);
  });

  it("ne refête pas ce qui était déjà obtenu", () => {
    // Sans quoi l'élève verrait « nouveau haut fait ! » à chaque exercice
    // rendu, et cesserait de le lire.
    const faits = hautsFaits(stats({ rendus: 5 }), 0);
    expect(nouveauxHautsFaits(faits, faits)).toEqual([]);
  });
});
