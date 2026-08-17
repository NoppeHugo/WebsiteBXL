import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Envoie une alerte à l'exploitant.
 *
 *   node --experimental-strip-types scripts/alerter.ts "sujet" < corps
 *
 * Existe pour les tâches d'exploitation — sauvegarde, surveillance — qui
 * tournent sur l'hôte, hors des conteneurs, et n'ont donc pas accès au
 * transport de courriel de l'API.
 *
 * Écrit sur la sortie standard ce qu'il a fait, et **ne se plaint jamais assez
 * fort pour arrêter l'appelant** : une sauvegarde réussie dont l'alerte
 * n'aurait pas pu partir reste une sauvegarde réussie. C'est le code de sortie
 * de l'appelant qui compte, pas celui-ci.
 */

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Lit le .env sans dépendance : ce script tourne avant tout empaquetage. */
function lireEnv(): Record<string, string> {
  const valeurs: Record<string, string> = { ...process.env } as Record<string, string>;
  let brut: string;
  try {
    brut = readFileSync(join(repoRoot, ".env"), "utf8");
  } catch {
    return valeurs;
  }

  for (const ligne of brut.split("\n")) {
    const nette = ligne.trim();
    if (!nette || nette.startsWith("#")) continue;
    const separateur = nette.indexOf("=");
    if (separateur === -1) continue;
    const cle = nette.slice(0, separateur).trim();
    let valeur = nette.slice(separateur + 1).trim();
    // Les guillemets sont là pour `source .env` en bash ; ils ne font pas
    // partie de la valeur.
    if (
      (valeur.startsWith('"') && valeur.endsWith('"')) ||
      (valeur.startsWith("'") && valeur.endsWith("'"))
    ) {
      valeur = valeur.slice(1, -1);
    }
    // L'environnement réel l'emporte sur le fichier : c'est ce qui permet de
    // tester avec une autre adresse sans toucher au .env.
    if (valeur && !(cle in process.env)) valeurs[cle] = valeur;
  }
  return valeurs;
}

async function lireEntree(): Promise<string> {
  const morceaux: Buffer[] = [];
  for await (const morceau of process.stdin) morceaux.push(morceau as Buffer);
  return Buffer.concat(morceaux).toString("utf8");
}

const sujet = process.argv[2];
if (!sujet) {
  console.error('usage : alerter.ts "sujet" < corps');
  process.exit(1);
}

const env = lireEnv();
const corps = (await lireEntree()).trim() || "(sans détail)";

/*
 * Destinataire : `ALERTES_EMAIL` s'il est renseigné, sinon le compte SMTP
 * lui-même. Ce repli est délibéré — une alerte qui n'a nulle part où aller est
 * une alerte perdue, et l'adresse du compte d'envoi est forcément valide et
 * relevée par l'exploitant.
 */
const destinataire = env.ALERTES_EMAIL || env.SMTP_USER;
if (!destinataire) {
  console.error("aucun destinataire : renseigner ALERTES_EMAIL ou SMTP_USER dans .env");
  process.exit(0);
}

if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
  console.error("SMTP incomplet dans .env : alerte non envoyée");
  console.error(`--- ${sujet} ---\n${corps}`);
  process.exit(0);
}

const port = Number(env.SMTP_PORT || 465);

try {
  const nodemailer = (await import("nodemailer")).default;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    // 465 chiffre d'emblée ; les autres ports passent par STARTTLS.
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  await transport.sendMail({
    from: env.MAIL_FROM || env.SMTP_USER,
    to: destinataire,
    subject: `[serveur] ${sujet}`,
    text: `${corps}\n\n--\nEnvoyé par scripts/alerter.ts sur ${
      env.HOSTNAME || "le serveur"
    }, le ${new Date().toLocaleString("fr-BE", { timeZone: "Europe/Brussels" })}.`,
  });

  console.log(`alerte envoyée à ${destinataire}`);
} catch (erreur) {
  // On écrit quand même le contenu : journalisé par systemd, il reste
  // consultable même si le courriel n'est pas parti.
  console.error(`envoi impossible : ${(erreur as Error).message}`);
  console.error(`--- ${sujet} ---\n${corps}`);
}
