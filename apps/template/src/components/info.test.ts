import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Contrôle sur le texte source de `Info.astro`.
 *
 * Même parti pris que `layouts/base.test.ts` : les tests ne rendent pas le
 * template, et cette règle-là vient d'un défaut constaté sur un site réellement
 * construit.
 */

const source = readFileSync(
  fileURLToPath(new URL("./Info.astro", import.meta.url)),
  "utf8",
);

describe("horaires", () => {
  it("ne liste pas sept « Fermé » quand aucun horaire n'est renseigné", () => {
    /*
     * Un commerce dont les horaires ne sont pas encore saisis n'est pas un
     * commerce fermé sept jours sur sept. La liste complète, tous les jours à
     * « Fermé », se lisait comme un salon qui a cessé son activité — et c'est
     * l'état exact d'un site créé en clientèle, avant qu'on ait demandé ses
     * heures au commerçant. Un site de vente qui annonce la fermeture du
     * commerce qu'il vend.
     */
    expect(source).toContain("horairesInconnus");
    expect(source).toContain('ui(lang, "hours_unset")');
  });

  it("garde la liste jour par jour dès qu'un seul jour est ouvert", () => {
    // Un salon fermé le lundi doit bien afficher « Lundi — Fermé » : c'est une
    // information, contrairement à sept lignes identiques.
    expect(source).toContain('ui(lang, "closed")');
    expect(source).toContain("WEEKDAYS.map");
  });
});
