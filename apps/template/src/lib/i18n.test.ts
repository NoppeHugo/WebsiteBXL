import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { METIERS } from "@bxl/schema/metiers";

/**
 * Contrôle sur le texte source d'`i18n.ts`.
 *
 * Même parti pris que `components/info.test.ts` : importer le module tirerait
 * `client.ts`, donc un client à construire. Or ce qui doit être vérifié ici ne
 * demande pas de rendu — ce sont deux cohérences entre fichiers, et toutes
 * deux échouent en silence :
 *
 *  - un métier qui remplace une clé d'interface qui n'existe pas : le
 *    remplacement est simplement ignoré, et le site affiche « Prestations &
 *    tarifs » chez un restaurant sans que rien ne le signale ;
 *  - une clé traduite dans une langue et pas dans une autre : la version
 *    néerlandaise retombe sur le français, au milieu d'une phrase.
 */

const source = readFileSync(
  fileURLToPath(new URL("./i18n.ts", import.meta.url)),
  "utf8",
);

/** Les clés déclarées dans un bloc de langue, telles qu'écrites. */
function clesDe(langue: "fr" | "nl" | "en"): Set<string> {
  const debut = source.indexOf(`\n  ${langue}: {`);
  expect(debut, `bloc de langue introuvable : ${langue}`).toBeGreaterThan(-1);
  const fin = source.indexOf("\n  },", debut);
  const bloc = source.slice(debut, fin);
  return new Set([...bloc.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]!));
}

describe("libellés d'interface", () => {
  it("traduit chaque clé dans les trois langues", () => {
    const fr = clesDe("fr");
    for (const langue of ["nl", "en"] as const) {
      const autres = clesDe(langue);
      for (const cle of fr) {
        expect(autres.has(cle), `${cle} manque en ${langue}`).toBe(true);
      }
      for (const cle of autres) {
        expect(fr.has(cle), `${cle} existe en ${langue} mais pas en fr`).toBe(true);
      }
    }
  });

  it("ne laisse aucun métier remplacer une clé qui n'existe pas", () => {
    /*
     * Le vocabulaire d'un métier est un `Record<string, …>` : une faute de
     * frappe — `services_titre` pour `services_title` — passe la compilation
     * et ne change rien à l'écran. Avec seize métiers, ce test est la seule
     * chose qui l'attrape.
     */
    const connues = clesDe("fr");
    for (const metier of Object.values(METIERS)) {
      for (const cle of Object.keys(metier.vocabulaire)) {
        expect(connues.has(cle), `${metier.id} remplace une clé inconnue : ${cle}`).toBe(true);
      }
    }
  });

  it("porte les libellés des sections ouvertes aux nouveaux métiers", () => {
    // La carte, le planning et la demande de table sont arrivés avec les
    // métiers de bouche : sans ces clés, leurs sections s'affichent sans titre.
    for (const cle of ["menu_title", "schedule_title", "table_title", "table_party"]) {
      expect(clesDe("fr").has(cle), cle).toBe(true);
    }
  });
});
