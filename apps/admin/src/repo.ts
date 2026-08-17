import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadClient, listClients } from "@bxl/schema/load";
import { SiteConfig } from "@bxl/schema";
import { config } from "./config.ts";

/*
 * Toutes les écritures passent par git : la console n'est qu'une interface
 * d'édition confortable au-dessus du dépôt (README §3.6). L'historique, le
 * retour arrière et l'édition à la main restent donc possibles.
 */

export interface CommandResult {
  ok: boolean;
  output: string;
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? config.REPO_PATH,
      env: { ...process.env, ...options.env },
    });

    let output = "";
    const capture = (chunk: Buffer) => {
      // Bornée : un build bavard ne doit pas faire enfler la mémoire du
      // processus ni la page affichée.
      if (output.length < 20_000) output += chunk.toString();
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);

    const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs ?? 300_000);

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: `${output}\n${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output });
    });
  });
}

export function clients(): string[] {
  return listClients(config.REPO_PATH);
}

export function client(slug: string) {
  return loadClient(config.REPO_PATH, slug);
}

/**
 * Écrit un `site.json` après validation.
 *
 * La validation passe par le même schéma que le build : la console ne peut pas
 * produire un fichier que l'intégration continue refuserait ensuite.
 */
export function writeSite(slug: string, next: unknown): { ok: true } | { ok: false; errors: string[] } {
  const parsed = SiteConfig.safeParse(next);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(racine)"} — ${i.message}`,
      ),
    };
  }
  if (parsed.data.slug !== slug) {
    return { ok: false, errors: ["slug incohérent"] };
  }

  const path = join(config.REPO_PATH, "clients", slug, "site.json");
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return { ok: true };
}

export function readSiteRaw(slug: string): Record<string, unknown> {
  const path = join(config.REPO_PATH, "clients", slug, "site.json");
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export async function commitAndPush(
  slug: string,
  message: string,
): Promise<CommandResult> {
  const add = await run("git", ["add", `clients/${slug}`]);
  if (!add.ok) return add;

  const status = await run("git", ["status", "--porcelain", `clients/${slug}`]);
  if (status.ok && status.output.trim() === "") {
    return { ok: true, output: "aucun changement à enregistrer" };
  }

  const commit = await run("git", ["commit", "-m", message]);
  if (!commit.ok) return commit;

  return run("git", ["push"], { timeoutMs: 120_000 });
}

/**
 * Construit puis déploie un seul client, sur la machine hôte.
 *
 * Le travail n'est pas fait ici, et ne peut pas l'être. Les dépendances de
 * /srv/repo sont installées sur l'hôte — Ubuntu, donc glibc — tandis que la
 * console tourne sur une image Alpine, en musl. Rollup et sharp chargent des
 * binaires natifs propres à une bibliothèque C : lancé depuis le conteneur, le
 * build s'arrête sur « Cannot find module @rollup/rollup-linux-x64-musl ».
 * Installer un second jeu de dépendances dans l'image reviendrait à entretenir
 * deux arborescences pour le même dépôt.
 *
 * S'y ajoute `deploy.sh`, qui passe par ssh vers DEPLOY_HOST : depuis un
 * conteneur, « localhost » désigne le conteneur et non la machine.
 *
 * Tout ce qu'il faut vit donc sur l'hôte ; la console s'y connecte et lance
 * `scripts/publier.sh`.
 *
 * L'hôte est joint par un nom déclaré dans Compose (`extra_hosts`), qui pointe
 * la passerelle du réseau Docker : son adresse change d'une machine à l'autre
 * et ne peut donc pas être écrite en dur.
 */
export async function publish(slug: string): Promise<CommandResult> {
  if (!config.PUBLISH_HOST) {
    return {
      ok: false,
      output:
        "PUBLISH_HOST n'est pas défini : la console ne sait pas à quelle machine " +
        "confier la construction. Renseignez-le dans .env (voir §6.3 de la procédure).",
    };
  }

  return run(
    "ssh",
    [
      "-i",
      config.SSH_KEY,
      // La passerelle Docker n'a pas d'empreinte stable d'une machine à
      // l'autre ; la vérification stricte bloquerait la première publication
      // sur une question que personne ne voit. La liaison ne quitte pas la
      // machine, contrairement à celle vers GitHub, qui reste vérifiée.
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "BatchMode=yes",
      config.PUBLISH_HOST,
      // Chemin côté hôte : la commande s'exécute là-bas, pas dans le conteneur.
      `${config.PUBLISH_REPO}/scripts/publier.sh`,
      slug,
    ],
    { timeoutMs: 600_000 },
  );
}

/**
 * Installe un client tout juste créé : visuels, bloc nginx, certificat, mise
 * en ligne.
 *
 * Même mécanique que `publish`, et pour les mêmes raisons : le travail se fait
 * sur l'hôte. S'y ajoute ici l'écriture d'un bloc nginx et la demande d'un
 * certificat, qui demandent root — le script hôte passe par un utilitaire
 * installé hors du dépôt, lui seul autorisé par sudo (voir infra/bxl-vhost).
 *
 * Le seul argument transmis est l'identifiant, et il est revalidé ici avant
 * l'envoi. Ce qu'on écrit là part dans une commande interprétée par un shell
 * distant : un nom de commerce libre, avec ses apostrophes et ses espaces, y
 * serait une porte ouverte. Tout le reste — nom, adresse, téléphone — est déjà
 * dans le `site.json` que le script hôte relit sur place.
 */
export async function installerSite(slug: string): Promise<CommandResult> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, output: `identifiant refusé : « ${slug} »` };
  }
  if (!config.PUBLISH_HOST) {
    return {
      ok: false,
      output:
        "PUBLISH_HOST n'est pas défini : la console ne sait pas à quelle machine " +
        "confier l'installation. Renseignez-le dans .env (voir §6.3 de la procédure).",
    };
  }

  return run(
    "ssh",
    [
      "-i",
      config.SSH_KEY,
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "BatchMode=yes",
      config.PUBLISH_HOST,
      `${config.PUBLISH_REPO}/scripts/nouveau-site.sh`,
      slug,
    ],
    { timeoutMs: 600_000 },
  );
}

/** Récupère les derniers changements avant d'éditer, pour éviter un conflit. */
export async function pull(): Promise<CommandResult> {
  return run("git", ["pull", "--rebase"], { timeoutMs: 120_000 });
}
