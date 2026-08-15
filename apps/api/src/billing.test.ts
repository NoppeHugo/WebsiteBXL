import { describe, expect, it } from "vitest";
import { needsAttention, statusLabel, formatAmount } from "./billing.ts";

/**
 * Ces fonctions décident si un site doit être suspendu et ce que l'exploitant
 * lit à l'écran : une erreur ici coupe le site d'un client à jour, ou laisse
 * en ligne un client qui ne paie plus.
 */
describe("état d'un abonnement", () => {
  it("ne réclame rien tant que le prélèvement passe", () => {
    expect(needsAttention("active")).toBe(false);
    expect(needsAttention("trialing")).toBe(false);
  });

  it("ne réclame rien pendant la signature du mandat", () => {
    // Un mandat pas encore signé n'est pas un impayé : suspendre là serait
    // couper le site d'un client qui vient de payer son installation.
    expect(needsAttention("incomplete")).toBe(false);
  });

  it("signale les impayés et les résiliations", () => {
    expect(needsAttention("past_due")).toBe(true);
    expect(needsAttention("unpaid")).toBe(true);
    expect(needsAttention("canceled")).toBe(true);
  });

  it("nomme chaque état en français", () => {
    expect(statusLabel("past_due")).toBe("impayé");
    expect(statusLabel("active")).toBe("à jour");
  });
});

describe("montants", () => {
  it("affiche un montant rond sans décimales", () => {
    expect(formatAmount(3900)).toMatch(/^39\s*€$/);
  });

  it("garde les centimes quand il y en a", () => {
    expect(formatAmount(3950)).toMatch(/39,50/);
  });

  it("tolère un montant inconnu", () => {
    expect(formatAmount(null)).toBe("—");
  });
});
