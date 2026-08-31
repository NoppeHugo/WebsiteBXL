import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/*
 * Authentification de la console.
 *
 * Un seul utilisateur au départ, mais la sécurité reste sérieuse : cette
 * application peut modifier et mettre hors ligne l'intégralité des sites
 * clients. C'est l'actif le plus sensible du projet (README §6).
 *
 * scrypt et HMAC viennent de Node : aucune dépendance native à recompiler,
 * et rien à mettre à jour en urgence le jour d'une faille dans une
 * bibliothèque tierce.
 */

const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, "base64");
  const derived = await scryptAsync(
    password,
    Buffer.from(saltB64, "base64"),
    expected.length,
  );
  // Comparaison à temps constant : une comparaison naïve laisse deviner le
  // hachage octet par octet.
  return timingSafeEqual(derived, expected);
}

/* -------------------------------------------------------------------------- */
/* TOTP                                                                       */
/* -------------------------------------------------------------------------- */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");

  let secret = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += BASE32[Number.parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("secret TOTP invalide");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpAt(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Vérifie un code TOTP. La fenêtre d'un pas de part et d'autre absorbe le
 * décalage d'horloge du téléphone, sans ouvrir une brèche utile.
 */
export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  const cleaned = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;

  const counter = Math.floor(now / 1000 / 30);
  for (const drift of [-1, 0, 1]) {
    const expected = totpAt(secret, counter + drift);
    if (
      timingSafeEqual(Buffer.from(expected), Buffer.from(cleaned))
    ) {
      return true;
    }
  }
  return false;
}

/** URI à afficher en QR code dans une application d'authentification. */
export function totpUri(secret: string, email: string, issuer = "WebsiteBXL"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6`;
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Deux populations, deux tables, un seul cookie.
 *
 * `qui` dit dans quelle table relire le compte à chaque requête : les élèves
 * ont la leur (voir la migration 011). Sans ce champ, l'identifiant 7 d'un
 * élève désignerait le compte 7 de la console — qui peut mettre trente sites
 * hors ligne.
 *
 * Absent des jetons émis avant l'espace de cours, il vaut « admin » : c'est ce
 * qu'étaient tous les comptes jusque-là, et les sessions en cours restent
 * valables au déploiement.
 */
export type QuiSession = "admin" | "eleve";

export interface Session {
  userId: number;
  expiresAt: number;
  qui?: QuiSession;
}

/**
 * Session signée, sans table ni cache : le jeton porte l'identifiant et son
 * échéance, l'empreinte HMAC garantit qu'il n'a pas été fabriqué. Changer
 * `SESSION_SECRET` invalide toutes les sessions d'un coup — c'est le bouton
 * d'urgence.
 */
export function signSession(session: Session, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function readSession(
  token: string | undefined,
  secret: string,
): Session | undefined {
  if (!token) return undefined;

  const [payload, mac] = token.split(".");
  if (!payload || !mac) return undefined;

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const given = Buffer.from(mac);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return undefined;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Session;
    if (typeof session.userId !== "number" || session.expiresAt < Date.now()) {
      return undefined;
    }
    /*
     * Un `qui` inconnu — jeton forgé par quelqu'un qui connaîtrait le secret,
     * ou format d'une version future relu par une version ancienne — n'ouvre
     * rien plutôt que d'ouvrir le monde le plus large.
     */
    if (session.qui !== undefined && session.qui !== "admin" && session.qui !== "eleve") {
      return undefined;
    }
    return session;
  } catch {
    return undefined;
  }
}
