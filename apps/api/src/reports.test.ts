import { describe, expect, it } from "vitest";
import { previousMonth, monthLabel, shouldRunToday } from "./reports.ts";

describe("mois précédent", () => {
  it("recule d'un mois", () => {
    expect(previousMonth(new Date("2026-08-15T00:00:00Z"))).toBe("2026-07");
  });

  it("franchit le changement d'année", () => {
    expect(previousMonth(new Date("2026-01-03T00:00:00Z"))).toBe("2025-12");
  });

  it("ne déborde pas depuis un 31", () => {
    // Un calcul naïf sur le jour courant donnerait « 2026-03 » depuis un
    // 31 mars, parce que le 31 février n'existe pas.
    expect(previousMonth(new Date("2026-03-31T00:00:00Z"))).toBe("2026-02");
  });
});

describe("libellé du mois", () => {
  it("traduit selon la langue du commerçant", () => {
    expect(monthLabel("2026-07", "fr")).toBe("juillet 2026");
    expect(monthLabel("2026-07", "nl")).toBe("juli 2026");
    expect(monthLabel("2026-07", "en")).toBe("July 2026");
  });

  it("retombe sur le français pour une langue inconnue", () => {
    expect(monthLabel("2026-07", "de")).toBe("juillet 2026");
  });
});

describe("jour d'envoi", () => {
  it("attend le 2 du mois", () => {
    // Le 1er, les événements de la veille peuvent encore arriver.
    expect(shouldRunToday(new Date("2026-08-01T09:00:00Z"))).toBe(false);
    expect(shouldRunToday(new Date("2026-08-02T09:00:00Z"))).toBe(true);
  });
});
