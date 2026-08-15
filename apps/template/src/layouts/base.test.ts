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

describe("retour d'envoi sans JavaScript", () => {
  it("porte les deux ancres attendues par l'API", () => {
    /*
     * L'API renvoie vers ces ancres après un envoi classique, et c'est `:target`
     * qui révèle le bandeau. Les renommer d'un côté sans l'autre ne casse rien
     * de visible : le visiteur est simplement renvoyé sur une page muette, sans
     * savoir si son message est parti.
     */
    expect(source).toContain('id="envoi-ok"');
    expect(source).toContain('id="envoi-ko"');
  });

  it("écrit les deux messages dans le HTML livré", () => {
    // Pas seulement dans le script : sans JavaScript, seul le HTML parle.
    const body = source.slice(source.indexOf("<body"));
    expect(body).toContain('ui(lang, "form_ok")');
    expect(body).toContain('ui(lang, "form_error")');
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
