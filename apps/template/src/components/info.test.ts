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

describe("fermetures exceptionnelles", () => {
  it("les affiche : sans cela, elles ne bloquaient que la réservation", () => {
    /*
     * Le défaut d'origine : « Je ferme » écrivait la fermeture dans le fichier
     * et bloquait l'agenda, mais le site n'en disait rien. La grille affichait
     * « Mardi 09:00 – 18:30 » pendant les congés, et le client se déplaçait —
     * exactement ce que le commerçant croyait avoir évité.
     */
    expect(source).toContain("site.closures");
    expect(source).toContain("data-fermetures");
  });

  it("décide dans le navigateur quelle fermeture est en cours", () => {
    /*
     * Le site est statique. Figer « aujourd'hui » à la construction produirait
     * un bandeau périmé dès le lendemain — le projet s'est déjà fait prendre
     * par là avec la date du jour de l'agenda, qui vidait le calendrier à
     * mesure que la publication s'éloignait.
     *
     * Et dans le fuseau du commerce, pas celui du visiteur.
     */
    const script = source.slice(source.lastIndexOf("<script>"));
    expect(script).toContain('timeZone: "Europe/Brussels"');
    expect(script).toContain("data-fermetures");
  });

  it("contredit la ligne du jour quand une fermeture la couvre", () => {
    /*
     * Sans cette règle, l'écran se contredisait : la ligne du jour restait en
     * gras avec ses heures juste au-dessus d'un encadré annonçant la
     * fermeture. Le regard va d'abord au gras.
     */
    expect(source).toContain("fermeExceptionnel");
    expect(source).toContain("data-mot-ferme");
  });
});
