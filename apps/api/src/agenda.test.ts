import { describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { cancelByToken } from "./agenda.ts";

/**
 * Annulation par jeton.
 *
 * Le jeton fait office d'authentification : il n'y a pas de compte client. Les
 * quatre issues doivent donc être nettes, et surtout distinctes — répondre
 * « annulé » à un jeton inconnu laisserait croire à quelqu'un que son
 * rendez-vous a sauté alors qu'il tient toujours.
 */

function fakeSql(row: unknown): { sql: Sql; updates: number } {
  const state = { updates: 0 };

  const sql = ((strings: TemplateStringsArray) => {
    const query = strings.join("?");
    if (/^\s*update/i.test(query.trim())) {
      state.updates += 1;
      return Promise.resolve([]);
    }
    return Promise.resolve(row ? [row] : []);
  }) as unknown as Sql;

  return {
    sql,
    get updates() {
      return state.updates;
    },
  };
}

const now = new Date("2026-08-17T09:00:00Z");

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "42",
    business_name: "Maison Verhaeren",
    service_name: "Coupe homme",
    starts_at: "2026-08-18T10:15:00.000Z",
    status: "booked",
    customer_name: "Sophie Martin",
    locale: "fr",
    ...overrides,
  };
}

describe("annulation par jeton", () => {
  it("annule un rendez-vous à venir", async () => {
    const fake = fakeSql(appointment());
    expect(await cancelByToken(fake.sql, "jeton", now)).toBe("cancelled");
    expect(fake.updates).toBe(1);
  });

  it("distingue un jeton inconnu", async () => {
    const fake = fakeSql(undefined);
    expect(await cancelByToken(fake.sql, "inconnu", now)).toBe("unknown");
    expect(fake.updates).toBe(0);
  });

  it("reconnaît une annulation déjà faite", async () => {
    // Le lien reste dans la boîte mail : le client peut très bien y revenir.
    // Il doit lire « déjà annulé », pas une erreur.
    const fake = fakeSql(appointment({ status: "cancelled" }));
    expect(await cancelByToken(fake.sql, "jeton", now)).toBe("already");
    expect(fake.updates).toBe(0);
  });

  it("refuse d'annuler après l'heure du rendez-vous", async () => {
    // Annuler après coup effacerait l'absence des statistiques du salon,
    // c'est-à-dire précisément ce qu'il a besoin de voir.
    const fake = fakeSql(appointment());
    const after = new Date("2026-08-18T11:00:00Z");
    expect(await cancelByToken(fake.sql, "jeton", after)).toBe("too_late");
    expect(fake.updates).toBe(0);
  });

  it("refuse à l'instant exact du rendez-vous", async () => {
    const fake = fakeSql(appointment());
    const exact = new Date("2026-08-18T10:15:00.000Z");
    expect(await cancelByToken(fake.sql, "jeton", exact)).toBe("too_late");
  });

  it("accepte une minute avant", async () => {
    const fake = fakeSql(appointment());
    const justBefore = new Date("2026-08-18T10:14:00.000Z");
    expect(await cancelByToken(fake.sql, "jeton", justBefore)).toBe("cancelled");
  });
});
