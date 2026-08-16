import { describe, expect, it, vi, afterEach } from "vitest";
import { depuis, statutLisible, STATUTS, escape } from "./views.ts";

/**
 * Ces fonctions ne touchent ni à la base ni au disque : elles se testent
 * telles quelles. C'est justement ce qui permet de vérifier le vocabulaire
 * affiché — un « draft » qui ressortirait en anglais dans la console est un
 * défaut d'interface, pas une broutille de rendu.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("statuts lisibles", () => {
  it("traduit les trois états connus", () => {
    expect(statutLisible("draft")).toBe("Brouillon");
    expect(statutLisible("live")).toBe("En ligne");
    expect(statutLisible("suspended")).toBe("Suspendu");
  });

  it("laisse passer un état inconnu plutôt que d'afficher du vide", () => {
    // Un statut ajouté au schéma sans passer ici doit rester visible : illisible
    // vaut mieux qu'invisible, on peut le repérer et le corriger.
    expect(statutLisible("archived")).toBe("archived");
  });

  it("accompagne chaque état d'une explication", () => {
    for (const etat of Object.values(STATUTS)) {
      expect(etat.aide.length).toBeGreaterThan(20);
    }
  });
});

describe("depuis", () => {
  const maintenant = new Date("2026-08-16T20:00:00Z");

  const ilYA = (millisecondes: number) => {
    vi.useFakeTimers();
    vi.setSystemTime(maintenant);
    return new Date(maintenant.getTime() - millisecondes);
  };

  it("dit « jamais » quand rien n'a eu lieu", () => {
    expect(depuis(null)).toBe("jamais");
  });

  it("arrondit les secondes à « à l'instant »", () => {
    expect(depuis(ilYA(20_000))).toBe("à l'instant");
  });

  it("compte en minutes, puis en heures", () => {
    expect(depuis(ilYA(25 * 60_000))).toBe("il y a 25 min");
    expect(depuis(ilYA(3 * 3600_000))).toBe("il y a 3 h");
  });

  it("passe à « hier » puis aux jours", () => {
    expect(depuis(ilYA(24 * 3600_000))).toBe("hier");
    expect(depuis(ilYA(3 * 24 * 3600_000))).toBe("il y a 3 jours");
  });

  it("donne une date au-delà d'une semaine", () => {
    // Au-delà, « il y a 34 jours » ne dit plus rien d'utile : on veut la date.
    expect(depuis(ilYA(30 * 24 * 3600_000))).toMatch(/^le \d+ juillet$/);
  });
});

describe("échappement", () => {
  it("neutralise le balisage venu du contenu d'un client", () => {
    // Les noms de commerce viennent de site.json, que la console édite : sans
    // échappement, un chevron y suffirait à injecter du balisage dans la page.
    expect(escape(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });
});
