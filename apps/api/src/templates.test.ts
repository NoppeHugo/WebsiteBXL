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

/*
 * La demande de table emprunte la même route et le même courriel. Ce qui la
 * distingue tient en deux champs — l'heure et le nombre de couverts — et en
 * une promesse qu'il ne faut surtout pas faire : la table n'est pas retenue.
 */
const table: OrderMailData = {
  businessName: "Chez Marcel",
  name: "Claire Dubois",
  email: "claire@exemple.be",
  wantedDate: "2026-09-12",
  wantedTime: "19:30",
  partySize: 4,
  mode: "table",
  locale: "fr",
};

describe("courriels de demande de table", () => {
  it("met l'heure et les couverts en tête du courriel au restaurant", () => {
    // Le restaurateur lit ce message debout, entre deux services : ce sont les
    // deux seules informations qui décident si la table est possible.
    const mail = orderToBusiness(table);
    expect(mail.subject).toContain("Demande de table");
    expect(mail.subject).toContain("4 couverts");
    expect(mail.text).toContain("19:30");
    expect(mail.text).toContain("Couverts   : 4");
  });

  it("ne parle ni de livraison ni de retrait en boutique", () => {
    const mail = orderToBusiness(table);
    expect(mail.text).not.toContain("retrait en boutique");
    expect(mail.text).not.toContain("livraison");
  });

  it("dit au client que la table n'est pas encore retenue", () => {
    /*
     * Le malentendu qui coûterait le plus cher : croire la table réservée,
     * se présenter à vingt heures, et trouver la salle complète. C'est écrit
     * dans les trois langues.
     */
    expect(orderToCustomer(table).text).toContain("la table n'est pas encore retenue");
    expect(orderToCustomer({ ...table, locale: "nl" }).text).toContain(
      "de tafel is nog niet vastgelegd",
    );
    expect(orderToCustomer({ ...table, locale: "en" }).text).toContain(
      "the table is not held yet",
    );
  });

  it("écrit au client dans sa langue, avec l'heure et le nombre de couverts", () => {
    expect(orderToCustomer(table).subject).toContain("Votre demande de table");
    expect(orderToCustomer(table).text).toContain("Couverts : 4");
    expect(orderToCustomer({ ...table, locale: "nl" }).subject).toContain("Uw tafelaanvraag");
    expect(orderToCustomer({ ...table, locale: "nl" }).text).toContain("Personen: 4");
    expect(orderToCustomer({ ...table, locale: "en" }).text).toContain("Guests: 4");
  });

  it("ne nomme plus le fleuriste dans un courriel qui sert à tous les métiers", () => {
    /*
     * La phrase disait « le fleuriste vous recontacte ». Elle était juste tant
     * qu'un seul métier commandait ; elle est devenue fausse le jour où une
     * boucherie et un traiteur ont utilisé la même route.
     */
    expect(orderToCustomer(base).text).not.toContain("fleuriste");
    expect(orderToCustomer({ ...base, locale: "nl" }).text).not.toContain("bloemist");
    expect(orderToCustomer({ ...base, locale: "en" }).text).not.toContain("florist");
  });
});
