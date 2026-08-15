import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Contrôles sur le texte source de `Base.astro`.
 *
 * Lire du source plutôt que du comportement est inhabituel, et se justifie
 * ici : les trois scripts de cette page sont écrits dans des littéraux de
 * gabarit puis injectés tels quels. Rien ne les vérifie — ni le build, qui les
 * traite comme du texte, ni les tests, qui ne rendent pas le template
 * (`vitest.config.ts`). Chacune des règles ci-dessous vient d'une panne réelle
 * et silencieuse.
 */

const source = readFileSync(
  fileURLToPath(new URL("./Base.astro", import.meta.url)),
  "utf8",
);

describe("balise de mesure d'audience", () => {
  it("annonce un type dispensé de contrôle d'origine", () => {
    /*
     * En « application/json », le navigateur exige une requête préalable et
     * une autorisation d'identifiants qu'une balise ne peut pas obtenir : la
     * mesure ne partait donc jamais dès que l'API vivait sur un autre domaine
     * que le site — c'est-à-dire en production. La base est restée vide sans
     * que rien ne le signale.
     */
    expect(source).toContain('{ type: "text/plain" }');
    expect(source).not.toContain('type: "application/json"');
  });

  it("passe par sendBeacon, qui survit à la fermeture de l'onglet", () => {
    expect(source).toContain("navigator.sendBeacon");
  });

  it("ne lit rien sur l'appareil du visiteur", () => {
    // C'est ce qui dispense le site de bandeau de consentement (README §3.13).
    // Un jour où l'un de ces appels apparaîtrait, l'obligation reviendrait
    // avec lui, sans que personne n'y pense.
    const scripts = source.slice(source.indexOf("const collectScript"));
    expect(scripts).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});

describe("scripts en ligne", () => {
  it("n'utilise aucun accent grave", () => {
    /*
     * Ces scripts vivent dans des littéraux de gabarit : un seul accent grave
     * à l'intérieur, fût-ce dans un commentaire, referme le littéral et fait
     * échouer le build avec une erreur qui ne désigne pas la vraie ligne.
     */
    const blocks = [...source.matchAll(/const \w+Script = `([\s\S]*?)`;$/gm)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const [, body] of blocks) {
      expect(body).not.toContain("`");
    }
  });
});
