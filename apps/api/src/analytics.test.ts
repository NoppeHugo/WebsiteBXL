import { describe, expect, it } from "vitest";
import {
  visitorHash,
  deviceFrom,
  referrerHost,
  reportText,
  type MonthlySummary,
} from "./analytics.ts";

describe("empreinte de visiteur", () => {
  const base = {
    salt: "sel-du-jour",
    ip: "203.0.113.4",
    userAgent: "Mozilla/5.0",
    tenantId: "3f1b7c2e-9d4a-4f8b-8c1e-0a2b6d5e7f30",
  };

  it("est stable pour un même visiteur dans la journée", () => {
    expect(visitorHash(base)).toBe(visitorHash({ ...base }));
  });

  it("change dès que le sel du jour change", () => {
    // C'est ce qui empêche de suivre quelqu'un d'un jour à l'autre.
    expect(visitorHash({ ...base, salt: "sel-du-lendemain" })).not.toBe(
      visitorHash(base),
    );
  });

  it("sépare deux commerces différents", () => {
    expect(
      visitorHash({ ...base, tenantId: "11111111-2222-3333-4444-555555555555" }),
    ).not.toBe(visitorHash(base));
  });

  it("ne laisse pas transparaître l'adresse IP", () => {
    expect(visitorHash(base)).not.toContain("203.0.113");
  });
});

describe("appareil", () => {
  it("reconnaît un téléphone", () => {
    expect(deviceFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(deviceFrom("Mozilla/5.0 (Linux; Android 14)")).toBe("mobile");
  });

  it("classe le reste en ordinateur", () => {
    expect(deviceFrom("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe("desktop");
    expect(deviceFrom("")).toBe("desktop");
  });
});

describe("provenance", () => {
  it("ne garde que le domaine", () => {
    // Une URL de recherche complète peut contenir un nom de personne.
    expect(referrerHost("https://www.google.com/search?q=barbier+dansaert")).toBe(
      "google.com",
    );
  });

  it("ignore une provenance absente ou invalide", () => {
    expect(referrerHost(undefined)).toBeUndefined();
    expect(referrerHost("pas-une-url")).toBeUndefined();
  });
});

describe("message mensuel", () => {
  const summary: MonthlySummary = {
    views: 1,
    visitors: 1,
    calls: 1,
    directions: 1,
    bookings: 1,
    contacts: 1,
    mobileShare: 70,
    topReferrers: [],
  };

  it("accorde au singulier", () => {
    const text = reportText("Salon Marie", "août 2026", summary);
    expect(text).toContain("1 visiteur,");
    expect(text).toContain("1 page consultée");
    expect(text).toContain("1 demande de rendez-vous");
    expect(text).toContain("1 message via le formulaire");
    expect(text).not.toContain("1 demandes");
  });

  it("accorde au pluriel", () => {
    const text = reportText("Salon Marie", "août 2026", {
      ...summary,
      visitors: 12,
      views: 40,
      bookings: 3,
    });
    expect(text).toContain("12 visiteurs");
    expect(text).toContain("40 pages consultées");
    expect(text).toContain("3 demandes de rendez-vous");
  });

  it("tait les lignes sans aucun événement", () => {
    const text = reportText("Salon Marie", "août 2026", {
      ...summary,
      calls: 0,
      directions: 0,
      bookings: 0,
      contacts: 0,
    });
    expect(text).not.toContain("itinéraire");
    expect(text).not.toContain("rendez-vous");
  });
});
