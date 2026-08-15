import { describe, expect, it } from "vitest";
import { safeRedirect, wantsJson, returnTo, ok, rejected } from "./respond.ts";

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

/**
 * `returnTo` décide ce que voit un visiteur sans JavaScript après avoir
 * écrit au salon. Sans repli, il atterrissait sur du JSON brut au domaine de
 * l'API — ce qui arrive dès que l'adresse du site et l'origine enregistrée
 * divergent d'un « www ».
 */
describe("returnTo", () => {
  const origin = "https://salon-marie.be";

  /** Journal minimal : seul `warn` est appelé par la fonction. */
  function fakeRequest() {
    const warnings: unknown[] = [];
    return {
      request: { log: { warn: (...args: unknown[]) => warnings.push(args) } },
      warnings,
    };
  }

  it("garde l'adresse annoncée quand elle est du bon domaine", () => {
    const { request, warnings } = fakeRequest();
    expect(
      returnTo(request as never, "https://salon-marie.be/nl/", origin),
    ).toBe("https://salon-marie.be/nl/");
    expect(warnings).toHaveLength(0);
  });

  it("retombe sur l'origine du commerce plutôt que sur rien", () => {
    const { request } = fakeRequest();
    expect(returnTo(request as never, undefined, origin)).toBe(origin);
  });

  it("retombe sur l'origine, et le signale, quand l'adresse est refusée", () => {
    // Refuser en silence masquerait une configuration fautive : le site
    // déclare une adresse que le commerce enregistré ne reconnaît pas.
    const { request, warnings } = fakeRequest();
    expect(
      returnTo(request as never, "https://www.salon-marie.be/", origin),
    ).toBe(origin);
    expect(warnings).toHaveLength(1);
  });

  it("ne redirige jamais vers un domaine étranger", () => {
    const { request } = fakeRequest();
    expect(
      returnTo(request as never, "https://site-malveillant.example/", origin),
    ).toBe(origin);
  });
});

/**
 * Ancres de retour. Le site les porte en dur et les révèle sans JavaScript ;
 * les changer ici seulement renverrait le visiteur sur une page muette.
 */
describe("ancres de retour", () => {
  const request = { headers: { accept: "text/html" } };

  function fakeReply() {
    const state: { code?: number; url?: string; body?: unknown } = {};
    const reply = {
      code(c: number) { state.code = c; return reply; },
      send(b: unknown) { state.body = b; return reply; },
      redirect(url: string, c: number) { state.url = url; state.code = c; return reply; },
    };
    return { reply, state };
  }

  it("vise le bandeau de succès", () => {
    const { reply, state } = fakeReply();
    ok(request as never, reply as never, "https://salon-marie.be/");
    expect(state.code).toBe(303);
    expect(state.url).toBe("https://salon-marie.be/?sent=1#envoi-ok");
  });

  it("vise le bandeau d'échec", () => {
    const { reply, state } = fakeReply();
    rejected(request as never, reply as never, 400, "invalide", "https://salon-marie.be/");
    expect(state.url).toBe("https://salon-marie.be/?sent=0#envoi-ko");
  });

  it("répond en JSON quand le client en demande", () => {
    // Le formulaire amélioré affiche son propre message : le rediriger le
    // ferait recharger la page qu'il vient d'éviter de quitter.
    const { reply, state } = fakeReply();
    ok({ headers: { accept: "application/json" } } as never, reply as never, "https://salon-marie.be/");
    expect(state.code).toBe(200);
    expect(state.body).toEqual({ ok: true });
  });
});
