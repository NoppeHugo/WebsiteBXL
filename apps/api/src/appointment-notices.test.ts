import { describe, expect, it } from "vitest";
import { cancelledByBusiness } from "./appointment-notices.ts";

/**
 * Ce courriel est le seul moyen qu'a le client d'apprendre que le salon a
 * annulé. S'il ne part pas, ou s'il part sans le numéro de téléphone, le
 * client se déplace pour rien.
 */

const base = {
  customerName: "Sophie Martin",
  customerEmail: "sophie@exemple.be",
  businessName: "Maison Verhaeren",
  businessPhone: "+32 2 511 00 00",
  serviceName: "Coupe homme",
  when: "mardi 18 août 2026 à 12:15",
  locale: "fr",
};

describe("annulation par le salon", () => {
  it("s'adresse au client et nomme ce qui est annulé", () => {
    const mail = cancelledByBusiness(base);
    expect(mail.to).toBe("sophie@exemple.be");
    expect(mail.subject).toContain("Maison Verhaeren");
    expect(mail.text).toContain("Sophie Martin");
    expect(mail.text).toContain("Coupe homme");
    expect(mail.text).toContain("mardi 18 août 2026 à 12:15");
  });

  it("donne le téléphone du salon", () => {
    // C'est la seule action possible pour le client : sans le numéro, le
    // courriel se contente d'annoncer une mauvaise nouvelle.
    expect(cancelledByBusiness(base).text).toContain("+32 2 511 00 00");
  });

  it("écrit dans la langue du client", () => {
    expect(cancelledByBusiness({ ...base, locale: "nl" }).subject).toContain(
      "geannuleerd",
    );
    expect(cancelledByBusiness({ ...base, locale: "en" }).subject).toContain(
      "cancelled",
    );
  });

  it("retombe sur le français pour une langue inconnue", () => {
    const mail = cancelledByBusiness({ ...base, locale: "de" });
    expect(mail.subject).toContain("annulé");
    expect(mail.text).toContain("Bonjour");
  });
});
