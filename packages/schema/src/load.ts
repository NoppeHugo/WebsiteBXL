import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SiteConfig, ThemeConfig } from "./index.ts";

export interface LoadedClient {
  slug: string;
  dir: string;
  mediaDir: string;
  site: SiteConfig;
  theme: ThemeConfig;
}

/** Racine du dossier `clients/`, quel que soit l'endroit d'où on appelle. */
export function clientsRoot(repoRoot: string): string {
  return join(repoRoot, "clients");
}

export function listClients(repoRoot: string): string[] {
  const root = clientsRoot(repoRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

function readJson(path: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`fichier introuvable : ${path}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON invalide dans ${path} : ${(err as Error).message}`);
  }
}

/**
 * Charge et valide un client. Toute erreur de format arrête le build : mieux
 * vaut échouer en CI que déployer un site avec un texte manquant (README §6).
 */
export function loadClient(repoRoot: string, slug: string): LoadedClient {
  const dir = join(clientsRoot(repoRoot), slug);
  if (!existsSync(dir)) {
    const known = listClients(repoRoot);
    throw new Error(
      `client inconnu : « ${slug} ».` +
        (known.length ? ` Clients disponibles : ${known.join(", ")}` : ""),
    );
  }

  const site = SiteConfig.safeParse(readJson(join(dir, "site.json")));
  if (!site.success) {
    throw new Error(
      `site.json invalide pour « ${slug} » :\n${formatIssues(site.error)}`,
    );
  }
  if (site.data.slug !== slug) {
    throw new Error(
      `slug incohérent pour « ${slug} » : site.json déclare « ${site.data.slug} »`,
    );
  }

  const theme = ThemeConfig.safeParse(readJson(join(dir, "theme.json")));
  if (!theme.success) {
    throw new Error(
      `theme.json invalide pour « ${slug} » :\n${formatIssues(theme.error)}`,
    );
  }

  return {
    slug,
    dir,
    mediaDir: join(dir, "media"),
    site: site.data,
    theme: theme.data,
  };
}

function formatIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return error.issues
    .map((i) => `  • ${i.path.join(".") || "(racine)"} — ${i.message}`)
    .join("\n");
}
