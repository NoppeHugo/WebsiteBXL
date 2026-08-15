import { describe, expect, it } from "vitest";
import {
  availableSlots,
  isClosed,
  weekdayOf,
  brusselsOffset,
  type Busy,
} from "./availability.ts";

/**
 * Le calcul des créneaux est la pièce dont une erreur se voit immédiatement
 * chez le client : un créneau proposé puis refusé, ou deux personnes au même
 * fauteuil. Il est donc couvert cas par cas.
 */

const day = "2026-09-15"; // un mardi
const offsetMin = 120; // heure d'été belge

/** Instant local de ce jour-là, exprimé en UTC. */
function at(time: string): Date {
  return new Date(`${day}T${time}:00.000+02:00`);
}

const base = {
  day,
  hours: [{ opens: "09:00", closes: "12:00" }],
  busy: [] as Busy[],
  resources: 1,
  durationMin: 60,
  stepMin: 30,
  leadMin: 0,
  now: new Date(`${day}T00:00:00.000+02:00`),
  offsetMin,
};

describe("créneaux disponibles", () => {
  it("propose les débuts possibles dans la plage d'ouverture", () => {
    const slots = availableSlots(base);
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      at("09:00").toISOString(),
      at("09:30").toISOString(),
      at("10:00").toISOString(),
      at("10:30").toISOString(),
      at("11:00").toISOString(),
    ]);
  });

  it("ne propose pas un créneau qui déborderait sur la fermeture", () => {
    // Une coupe d'une heure à 11h30 finirait à 12h30 : promettre ça, c'est
    // faire attendre le client devant un salon fermé.
    const slots = availableSlots(base);
    expect(slots.at(-1)!.start.toISOString()).toBe(at("11:00").toISOString());
  });

  it("gère une journée coupée par la pause de midi", () => {
    const slots = availableSlots({
      ...base,
      hours: [
        { opens: "09:00", closes: "12:00" },
        { opens: "13:00", closes: "18:00" },
      ],
      durationMin: 60,
      stepMin: 60,
    });
    const starts = slots.map((s) => s.start.toISOString());
    expect(starts).toContain(at("11:00").toISOString());
    expect(starts).toContain(at("13:00").toISOString());
    expect(starts).not.toContain(at("12:00").toISOString());
  });

  it("retire les créneaux déjà pris", () => {
    const slots = availableSlots({
      ...base,
      busy: [{ start: at("10:00"), end: at("11:00") }],
    });
    const starts = slots.map((s) => s.start.toISOString());
    // 09:30 chevaucherait le rendez-vous existant, 10:00 aussi.
    expect(starts).not.toContain(at("09:30").toISOString());
    expect(starts).not.toContain(at("10:00").toISOString());
    expect(starts).toContain(at("09:00").toISOString());
    expect(starts).toContain(at("11:00").toISOString());
  });

  it("garde le créneau ouvert tant qu'un fauteuil reste libre", () => {
    // Deux barbiers, un seul occupé : le créneau reste proposable.
    const slots = availableSlots({
      ...base,
      resources: 2,
      busy: [{ start: at("10:00"), end: at("11:00") }],
    });
    expect(slots.map((s) => s.start.toISOString())).toContain(
      at("10:00").toISOString(),
    );
  });

  it("ferme le créneau quand tous les fauteuils sont pris", () => {
    const slots = availableSlots({
      ...base,
      resources: 2,
      busy: [
        { start: at("10:00"), end: at("11:00") },
        { start: at("10:00"), end: at("11:00") },
      ],
    });
    expect(slots.map((s) => s.start.toISOString())).not.toContain(
      at("10:00").toISOString(),
    );
  });

  it("respecte le délai de prévenance", () => {
    const slots = availableSlots({
      ...base,
      leadMin: 120,
      now: at("09:00"),
    });
    // À 9h avec deux heures de prévenance, rien avant 11h.
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      at("11:00").toISOString(),
    ]);
  });

  it("ne propose rien un jour de fermeture", () => {
    expect(availableSlots({ ...base, hours: [] })).toEqual([]);
  });

  it("ne propose rien sans personne pour recevoir", () => {
    expect(availableSlots({ ...base, resources: 0 })).toEqual([]);
  });

  it("ne propose rien si la prestation dépasse la journée", () => {
    expect(availableSlots({ ...base, durationMin: 600 })).toEqual([]);
  });
});

describe("fermetures exceptionnelles", () => {
  const closures = [{ from: "2026-12-24", to: "2027-01-02" }];

  it("reconnaît un jour à l'intérieur, bornes comprises", () => {
    expect(isClosed("2026-12-24", closures)).toBe(true);
    expect(isClosed("2026-12-28", closures)).toBe(true);
    expect(isClosed("2027-01-02", closures)).toBe(true);
  });

  it("laisse passer les jours autour", () => {
    expect(isClosed("2026-12-23", closures)).toBe(false);
    expect(isClosed("2027-01-03", closures)).toBe(false);
  });
});

describe("repères de calendrier", () => {
  it("donne le bon jour de la semaine", () => {
    expect(weekdayOf("2026-09-15")).toBe(2); // mardi
    expect(weekdayOf("2026-09-13")).toBe(0); // dimanche
  });

  it("suit l'heure d'été et l'heure d'hiver belges", () => {
    // Le décalage change dans l'année : le figer produirait des rendez-vous
    // décalés d'une heure la moitié du temps.
    expect(brusselsOffset("2026-07-15")).toBe(120);
    expect(brusselsOffset("2026-01-15")).toBe(60);
  });
});
