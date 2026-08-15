import { describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { sendReminders, cancelUrl, formatWhen } from "./reminders.ts";
import type { Mail } from "./mail.ts";

/**
 * Le rappel est la seule chose qui parte automatiquement vers le client final
 * du salon. Deux erreurs coûteraient cher : ne rien envoyer, et envoyer deux
 * fois. Les tests portent donc sur la marque d'envoi et sur son absence en cas
 * d'échec, plus que sur le texte.
 */

interface Recorded {
  query: string;
  values: unknown[];
}

/**
 * Faux client Postgres. La requête est reconstituée pour distinguer la lecture
 * de l'écriture — c'est tout ce dont ce module a besoin.
 */
function fakeSql(rows: unknown[]): { sql: Sql; calls: Recorded[] } {
  const calls: Recorded[] = [];

  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?");
    calls.push({ query, values });
    return Promise.resolve(/^\s*update/i.test(query.trim()) ? [] : rows);
  }) as unknown as Sql;

  return { sql, calls };
}

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "42",
    business_name: "Maison Verhaeren",
    origin: "https://maison-verhaeren.be",
    service_name: "Coupe homme",
    starts_at: "2026-08-18T10:15:00.000Z",
    customer_name: "Sophie Martin",
    customer_email: "sophie@exemple.be",
    locale: "fr",
    cancel_token: "7d6ac1a8-e230-4381-ad78-7abc0b9150c6",
    ...overrides,
  };
}

describe("lien d'annulation", () => {
  it("laisse la langue par défaut à la racine", () => {
    expect(cancelUrl("https://salon.be", "abc", "fr")).toBe(
      "https://salon.be/annulation/?t=abc",
    );
  });

  it("préfixe les autres langues", () => {
    expect(cancelUrl("https://salon.be", "abc", "nl")).toBe(
      "https://salon.be/nl/annulation/?t=abc",
    );
  });

  it("ne double pas la barre oblique quand l'origine en porte une", () => {
    // L'origine vient de la base, où elle a pu être saisie avec ou sans.
    expect(cancelUrl("https://salon.be/", "abc", "fr")).toBe(
      "https://salon.be/annulation/?t=abc",
    );
  });
});

describe("date lisible", () => {
  it("écrit l'heure de Bruxelles, pas celle du serveur", () => {
    // Le serveur tourne en UTC : sans le fuseau, le client lirait 10:15 pour
    // un rendez-vous à midi et quart.
    const when = formatWhen(new Date("2026-08-18T10:15:00Z"), "fr");
    expect(when).toContain("12:15");
    expect(when).toContain("18 août 2026");
  });
});

describe("envoi des rappels", () => {
  it("écrit au client et marque le rendez-vous", async () => {
    const { sql, calls } = fakeSql([appointment()]);
    const sent: Mail[] = [];

    const result = await sendReminders(sql, async (mail) => {
      sent.push(mail);
    });

    expect(result).toEqual({ sent: ["42"], failed: [] });
    expect(sent[0]!.to).toBe("sophie@exemple.be");
    expect(sent[0]!.subject).toContain("Maison Verhaeren");
    // Le lien d'annulation est la raison d'être du rappel : sans lui, le client
    // empêché ne libère pas le créneau.
    expect(sent[0]!.text).toContain(
      "https://maison-verhaeren.be/annulation/?t=7d6ac1a8-e230-4381-ad78-7abc0b9150c6",
    );
    expect(calls.some((c) => /update appointments/.test(c.query))).toBe(true);
  });

  it("écrit dans la langue du client", async () => {
    const { sql } = fakeSql([appointment({ locale: "nl" })]);
    const sent: Mail[] = [];
    await sendReminders(sql, async (mail) => {
      sent.push(mail);
    });
    expect(sent[0]!.subject).toContain("Herinnering");
    expect(sent[0]!.text).toContain("/nl/annulation/");
  });

  it("retombe sur le français pour une langue inconnue", async () => {
    const { sql } = fakeSql([appointment({ locale: "de" })]);
    const sent: Mail[] = [];
    await sendReminders(sql, async (mail) => {
      sent.push(mail);
    });
    expect(sent[0]!.subject).toContain("Rappel");
  });

  it("ne marque rien quand l'envoi échoue", async () => {
    // La marque posée malgré l'échec ferait perdre le rappel définitivement ;
    // sans elle, la passe suivante réessaie tant que la fenêtre dure.
    const { sql, calls } = fakeSql([appointment()]);

    const result = await sendReminders(sql, async () => {
      throw new Error("serveur SMTP injoignable");
    });

    expect(result).toEqual({ sent: [], failed: ["42"] });
    expect(calls.some((c) => /update appointments/.test(c.query))).toBe(false);
  });

  it("continue après un échec isolé", async () => {
    const { sql } = fakeSql([
      appointment({ id: "1", customer_email: "cassé" }),
      appointment({ id: "2" }),
    ]);

    const result = await sendReminders(sql, async (mail) => {
      if (mail.to === "cassé") throw new Error("adresse invalide");
    });

    expect(result).toEqual({ sent: ["2"], failed: ["1"] });
  });

  it("n'écrit à personne quand rien n'est dû", async () => {
    const { sql } = fakeSql([]);
    let called = 0;
    const result = await sendReminders(sql, async () => {
      called += 1;
    });
    expect(called).toBe(0);
    expect(result).toEqual({ sent: [], failed: [] });
  });

  it("borne la sélection entre dix-huit et trente-six heures", async () => {
    // La fenêtre est dans la requête, pas dans le code : ce test la fige, car
    // l'élargir sans y penser enverrait des rappels trois jours à l'avance.
    const { sql, calls } = fakeSql([]);
    await sendReminders(sql, async () => {});
    const select = calls[0]!.query;
    expect(select).toContain("interval '18 hours'");
    expect(select).toContain("interval '36 hours'");
    expect(select).toContain("reminder_sent_at is null");
    expect(select).toContain("a.status = 'booked'");
  });
});
