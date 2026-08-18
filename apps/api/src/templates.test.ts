import { describe, it, expect } from "vitest";
import { orderToBusiness, orderToCustomer, type OrderMailData } from "./templates.ts";

/*
 * L'accusé de réception d'une commande part chez le client final, dans sa
 * langue. C'est la seule trace écrite qu'il garde de ce qu'il a demandé —
 * d'où les trois choses vérifiées ici : la langue, le mot de la carte relu
 * tel quel, et l'absence de toute promesse de paiement ou de confirmation.
 */
const base: OrderMailData = {
  businessName: "Fleurs Van Aken",
  name: "Claire Dubois",
  email: "claire@exemple.be",
  occasion: "Mariage",
  budget: 120,
  wantedDate: "2026-09-12",
  mode: "delivery",
  address: "Rue du Page 12, 1050 Ixelles",
  card: "Pour Anne — merci pour tout.",
  locale: "fr",
};

describe("courriels de commande", () => {
  it("relit au client le mot de la carte, sans le retoucher", () => {
    const mail = orderToCustomer(base);
    expect(mail.text).toContain("Pour Anne — merci pour tout.");
  });

  it("dit que rien n'est payé ni confirmé", () => {
    const mail = orderToCustomer(base);
    expect(mail.text).toContain("Rien n'a été payé");
    expect(mail.text).toContain("rien n'est encore confirmé");
  });

  it("écrit au client dans sa langue", () => {
    expect(orderToCustomer(base).subject).toContain("Votre demande de commande");
    expect(orderToCustomer({ ...base, locale: "nl" }).subject).toContain(
      "Uw bestelaanvraag",
    );
    expect(orderToCustomer({ ...base, locale: "en" }).subject).toContain(
      "Your order request",
    );

    // La date se dit aussi dans la langue du client : « 12 september » chez un
    // néerlandophone, pas « 12 septembre ».
    expect(orderToCustomer({ ...base, locale: "nl" }).text).toContain("september");
  });

  it("reste lisible sans date ni mot pour la carte", () => {
    const mail = orderToCustomer({
      ...base,
      wantedDate: undefined,
      card: undefined,
      budget: undefined,
      occasion: undefined,
    });
    expect(mail.text).toContain("dès que possible");
    expect(mail.text).not.toContain("undefined");
    expect(mail.text).not.toContain("« »");
  });

  it("garde l'adresse de livraison des deux côtés", () => {
    expect(orderToBusiness(base).text).toContain("Rue du Page 12");
    expect(orderToCustomer(base).text).toContain("Rue du Page 12");
  });

  it("n'annonce pas de livraison pour un retrait en boutique", () => {
    const mail = orderToCustomer({ ...base, mode: "pickup", address: undefined });
    expect(mail.text).toContain("À retirer en boutique");
    expect(mail.text).not.toContain("Livraison");
  });
});
