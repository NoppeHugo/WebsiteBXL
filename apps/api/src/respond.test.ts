import { describe, expect, it } from "vitest";
import { safeRedirect, wantsJson } from "./respond.ts";

/**
 * `safeRedirect` est la seule chose qui empêche l'API de devenir une
 * redirection ouverte : un formulaire peut proposer n'importe quelle URL de
 * retour, et une redirection au nom du salon est un outil de hameçonnage
 * idéal.
 */
describe("safeRedirect", () => {
  const origin = "https://salon-marie.be";

  it("accepte une page du site du client", () => {
    expect(safeRedirect("https://salon-marie.be/nl/", origin)).toBe(
      "https://salon-marie.be/nl/",
    );
  });

  it("refuse un autre domaine", () => {
    expect(safeRedirect("https://site-malveillant.example/x", origin)).toBeUndefined();
  });

  it("refuse un sous-domaine qui ressemble", () => {
    expect(
      safeRedirect("https://salon-marie.be.attaquant.example/", origin),
    ).toBeUndefined();
  });

  it("refuse le même domaine sur un autre protocole", () => {
    expect(safeRedirect("http://salon-marie.be/", origin)).toBeUndefined();
  });

  it("refuse une URL invalide ou absente", () => {
    expect(safeRedirect("pas-une-url", origin)).toBeUndefined();
    expect(safeRedirect(undefined, origin)).toBeUndefined();
  });
});

describe("wantsJson", () => {
  it("reconnaît un envoi par fetch", () => {
    expect(wantsJson({ headers: { accept: "application/json" } } as never)).toBe(true);
  });

  it("traite un envoi de formulaire classique comme du HTML", () => {
    expect(
      wantsJson({ headers: { accept: "text/html,application/xhtml+xml" } } as never),
    ).toBe(false);
    expect(wantsJson({ headers: {} } as never)).toBe(false);
  });
});
