import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { sql } from "../db.ts";
import { hashPassword, generateTotpSecret, totpUri } from "../auth.ts";

/**
 * Crée ou met à jour le compte d'administration.
 *
 *   pnpm admin:create
 *
 * Le secret TOTP n'est affiché qu'une fois : la console peut mettre hors ligne
 * tous les sites clients, le mot de passe seul ne doit pas suffire.
 */

const args = process.argv.slice(2);
function option(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : undefined;
}

/*
 * Les valeurs peuvent venir d'arguments, ce qui rend la commande utilisable
 * dans un script de mise en service. La saisie interactive reste le mode par
 * défaut : un mot de passe passé en argument reste dans l'historique du shell.
 */
let email = option("email");
let password = option("password");

if (!email || !password) {
  const rl = createInterface({ input: stdin, output: stdout });
  email ??= await rl.question("Adresse e-mail : ");
  password ??= await rl.question("Mot de passe (au moins 12 caractères) : ");
  rl.close();
}

email = email.trim().toLowerCase();
password = password.trim();

if (!email.includes("@")) {
  console.error("adresse invalide");
  process.exit(1);
}
if (password.length < 12) {
  console.error("mot de passe trop court");
  process.exit(1);
}

const hash = await hashPassword(password);
const secret = generateTotpSecret();

await sql`
  insert into admin_users (email, password_hash, totp_secret)
  values (${email}, ${hash}, ${secret})
  on conflict (email) do update set
    password_hash = excluded.password_hash,
    totp_secret   = excluded.totp_secret
`;

console.log(`
✓ compte enregistré : ${email}

  Secret TOTP : ${secret}

  À ajouter dans une application d'authentification, par exemple avec cette URI :
  ${totpUri(secret, email)}

  Ce secret ne sera plus affiché.
`);

await sql.end();
