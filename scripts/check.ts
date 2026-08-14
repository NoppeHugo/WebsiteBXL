import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadClient, listClients } from "../packages/schema/src/load.ts";
import type { LocalizedText, Language } from "../packages/schema/src/index.ts";
import { repoRoot, colors, ok, fail } from "./lib.ts";

/**
 * Contrôle de tous les clients, sans lancer de build.
 *
 * Deux niveaux :
 *  - erreur   : le site ne peut pas être construit ou serait cassé en ligne.
 *  - avertissement : le site fonctionne mais quelque chose se vend moins bien
 *    (traduction manquante, fiche Google absente, texte alternatif oublié).
 *
 * C'est le premier des deux garde-fous du monorepo (README §6) : rien ne part
 * en production si ce contrôle échoue.
 */

interface Report {
  slug: string;
  errors: string[];
  warnings: string[];
}

const slugs = listClients(repoRoot);
if (slugs.length === 0) {
  console.log("aucun client à contrôler");
  process.exit(0);
}

const reports: Report[] = [];

for (const slug of slugs) {
  const report: Report = { slug, errors: [], warnings: [] };

  try {
    const { site, mediaDir } = loadClient(repoRoot, slug);
    const langs = site.languages.available;

    /** Signale les traductions manquantes dans les langues vendues au client. */
    const checkTranslations = (
      text: LocalizedText | undefined,
      label: string,
    ): void => {
      if (!text) return;
      const missing = langs.filter((l: Language) => !text[l]);
      if (missing.length > 0) {
        report.warnings.push(`${label} : non traduit en ${missing.join(", ")}`);
      }
    };

    checkTranslations(site.business.description, "business.description");
    checkTranslations(site.business.tagline, "business.tagline");
    checkTranslations(site.hero.headline, "hero.headline");
    checkTranslations(site.hero.subline, "hero.subline");
    for (const service of site.services) {
      checkTranslations(service.name, `service « ${service.id} »`);
    }

    // Les photos référencées doivent exister : une image manquante casse le
    // build, autant le savoir ici plutôt qu'en pleine livraison.
    const photos = [
      site.hero.image,
      ...site.gallery.map((p) => p.src),
      ...site.team.map((m) => m.photo).filter((p): p is string => Boolean(p)),
    ];
    for (const photo of photos) {
      if (!existsSync(join(mediaDir, photo))) {
        report.errors.push(`photo introuvable : media/${photo}`);
      }
    }

    for (const [index, photo] of site.gallery.entries()) {
      if (!photo.alt[site.languages.default]) {
        report.warnings.push(
          `gallery[${index}] : texte alternatif manquant (accessibilité et référencement)`,
        );
      }
    }

    // Points qui pèsent directement sur la vente.
    if (!site.business.googlePlaceId && !site.business.googleMapsUrl) {
      report.warnings.push(
        "aucune fiche Google renseignée — c'est pourtant l'argument d'entrée du pack",
      );
    }
    if (!site.business.geo) {
      report.warnings.push("coordonnées GPS absentes des données structurées");
    }
    if (site.plan !== "essentiel" && langs.length < 2) {
      report.warnings.push(
        `palier ${site.plan} vendu bilingue mais une seule langue activée`,
      );
    }
    if (site.services.length === 0) {
      report.warnings.push("aucune prestation : la section tarifs sera absente");
    }
    if (site.status === "live" && site.demo) {
      report.errors.push("un site marqué « demo » ne doit pas être en statut « live »");
    }
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  }

  reports.push(report);
}

let errorCount = 0;

for (const report of reports) {
  const status =
    report.errors.length > 0
      ? `${colors.red}✗${colors.reset}`
      : report.warnings.length > 0
        ? `${colors.yellow}!${colors.reset}`
        : `${colors.green}✓${colors.reset}`;

  console.log(`\n${status} ${report.slug}`);
  for (const error of report.errors) {
    console.log(`  ${colors.red}erreur${colors.reset}  ${error}`);
  }
  for (const warning of report.warnings) {
    console.log(`  ${colors.yellow}avert.${colors.reset}  ${warning}`);
  }
  errorCount += report.errors.length;
}

console.log("");
if (errorCount > 0) {
  fail(`${errorCount} erreur(s) sur ${reports.length} client(s)`);
}
ok(`${reports.length} client(s) contrôlé(s)`);
