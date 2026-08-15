import { describe, expect, it } from "vitest";
import { parseSlots, formatSlots } from "./hours.ts";

describe("horaires", () => {
  it("lit un créneau simple", () => {
    expect(parseSlots("09:30-18:30")).toEqual([{ open: "09:30", close: "18:30" }]);
  });

  it("lit une journée coupée par la pause de midi", () => {
    expect(parseSlots("09:00-12:30, 13:30-18:00")).toEqual([
      { open: "09:00", close: "12:30" },
      { open: "13:30", close: "18:00" },
    ]);
  });

  it("traite un champ vide comme un jour de fermeture", () => {
    expect(parseSlots("")).toEqual([]);
    expect(parseSlots("   ")).toEqual([]);
  });

  it("tolère les espaces et les virgules en trop", () => {
    expect(parseSlots(" 09:00 - 18:00 , ")).toEqual([
      { open: "09:00", close: "18:00" },
    ]);
  });

  it("fait l'aller-retour sans perdre d'information", () => {
    const source = [
      { open: "09:00", close: "12:30" },
      { open: "13:30", close: "18:00" },
    ];
    expect(parseSlots(formatSlots(source))).toEqual(source);
  });
});
