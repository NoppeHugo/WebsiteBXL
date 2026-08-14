import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const repoRoot = dirname(fileURLToPath(new URL(".", import.meta.url)));
export const templateDir = join(repoRoot, "apps", "template");
/** Dossier où le build copie les photos du client courant (hors versionnement). */
export const templateMediaDir = join(templateDir, "src", "media");
export const distDir = join(repoRoot, "dist");

export const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export function info(message: string): void {
  console.log(`${colors.cyan}▸${colors.reset} ${message}`);
}

export function ok(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

export function warn(message: string): void {
  console.log(`${colors.yellow}!${colors.reset} ${message}`);
}

export function fail(message: string): never {
  console.error(`${colors.red}✗${colors.reset} ${message}`);
  process.exit(1);
}

/** Lance une commande en héritant de la sortie, et rejette si le code ≠ 0. */
export function run(
  command: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} a terminé avec le code ${code}`));
    });
  });
}
