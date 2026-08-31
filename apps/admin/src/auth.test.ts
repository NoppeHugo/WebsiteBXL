import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateTotpSecret,
  verifyTotp,
  signSession,
  readSession,
} from "./auth.ts";

/**
 * L'interface d'administration peut modifier et mettre hors ligne tous les
 * sites clients. Ces tests couvrent la seule barrière qui l'en empêche.
 */

const SECRET = "un-secret-de-session-suffisamment-long-pour-etre-valide";

describe("mots de passe", () => {
  it("valide le bon mot de passe et rejette les autres", async () => {
    const stored = await hashPassword("motdepassetreslong123");
    expect(await verifyPassword("motdepassetreslong123", stored)).toBe(true);
    expect(await verifyPassword("motdepassetreslong124", stored)).toBe(false);
  });

  it("produit un condensat différent à chaque fois", async () => {
    // Sel aléatoire : deux comptes avec le même mot de passe ne doivent pas
    // être reconnaissables en base.
    const a = await hashPassword("motdepassetreslong123");
    const b = await hashPassword("motdepassetreslong123");
    expect(a).not.toBe(b);
  });

  it("rejette un condensat dans un format inconnu au lieu de planter", async () => {
    expect(await verifyPassword("x", "bcrypt$autre$format")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("TOTP", () => {
  const secret = generateTotpSecret();

  /** Reproduit le calcul d'une application d'authentification. */
  function codeAt(when: number): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const char of secret) {
      bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
    }
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(when / 1000 / 30)));
    const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
    const offset = digest[digest.length - 1]! & 0x0f;
    const value =
      ((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff);
    return String(value % 1_000_000).padStart(6, "0");
  }

  it("produit un secret en base32 de longueur utilisable", () => {
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepte le code courant", () => {
    const now = Date.now();
    expect(verifyTotp(secret, codeAt(now), now)).toBe(true);
  });

  it("tolère un décalage d'horloge d'un pas", () => {
    const now = Date.now();
    expect(verifyTotp(secret, codeAt(now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, codeAt(now + 30_000), now)).toBe(true);
  });

  it("refuse un code trop ancien", () => {
    const now = Date.now();
    expect(verifyTotp(secret, codeAt(now - 120_000), now)).toBe(false);
  });

  it("refuse ce qui n'est pas six chiffres", () => {
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
    expect(verifyTotp(secret, "")).toBe(false);
  });
});

describe("sessions", () => {
  it("relit une session qu'elle a signée", () => {
    const token = signSession({ userId: 7, expiresAt: Date.now() + 60_000 }, SECRET);
    expect(readSession(token, SECRET)?.userId).toBe(7);
  });

  it("refuse une session signée avec un autre secret", () => {
    // C'est le bouton d'urgence : changer le secret déconnecte tout le monde.
    const token = signSession({ userId: 7, expiresAt: Date.now() + 60_000 }, SECRET);
    expect(readSession(token, "un-autre-secret-tout-aussi-long-mais-different")).toBeUndefined();
  });

  it("refuse une charge utile modifiée", () => {
    const token = signSession({ userId: 7, expiresAt: Date.now() + 60_000 }, SECRET);
    const [, mac] = token.split(".");
    const forged = `${Buffer.from(
      JSON.stringify({ userId: 1, expiresAt: Date.now() + 60_000 }),
    ).toString("base64url")}.${mac}`;
    expect(readSession(forged, SECRET)).toBeUndefined();
  });

  it("refuse une session expirée", () => {
    const token = signSession({ userId: 7, expiresAt: Date.now() - 1 }, SECRET);
    expect(readSession(token, SECRET)).toBeUndefined();
  });

  it("refuse un jeton absent ou malformé", () => {
    expect(readSession(undefined, SECRET)).toBeUndefined();
    expect(readSession("nimportequoi", SECRET)).toBeUndefined();
    expect(readSession("a.b.c", SECRET)).toBeUndefined();
  });

  it("porte la table où relire le compte", () => {
    /*
     * L'identifiant seul ne suffit plus : les élèves ont leur propre table.
     * Sans ce champ, la session de l'élève numéro 7 rouvrirait le compte de
     * console numéro 7 — celui qui met trente sites hors ligne.
     */
    const token = signSession(
      { userId: 7, expiresAt: Date.now() + 60_000, qui: "eleve" },
      SECRET,
    );
    expect(readSession(token, SECRET)?.qui).toBe("eleve");
  });

  it("lit les jetons émis avant l'espace de cours comme des comptes de console", () => {
    // Les sessions en cours au moment du déploiement n'ont pas ce champ, et
    // déconnecter tout le monde pour une migration serait gratuit.
    const token = signSession({ userId: 7, expiresAt: Date.now() + 60_000 }, SECRET);
    expect(readSession(token, SECRET)?.qui).toBeUndefined();
  });

  it("refuse un rôle de session inconnu", () => {
    // Plutôt que de retomber sur « admin », qui est le monde le plus large.
    const payload = Buffer.from(
      JSON.stringify({ userId: 7, expiresAt: Date.now() + 60_000, qui: "exploitant" }),
    ).toString("base64url");
    const mac = createHmac("sha256", SECRET).update(payload).digest("base64url");
    expect(readSession(`${payload}.${mac}`, SECRET)).toBeUndefined();
  });

  it("refuse un identifiant qui n'est pas un nombre", () => {
    // Le pilote Postgres renvoie les bigserial en chaîne : une session portant
    // « 1 » au lieu de 1 doit être rejetée plutôt que silencieusement acceptée.
    const payload = Buffer.from(
      JSON.stringify({ userId: "1", expiresAt: Date.now() + 60_000 }),
    ).toString("base64url");
    const mac = createHmac("sha256", SECRET).update(payload).digest("base64url");
    expect(readSession(`${payload}.${mac}`, SECRET)).toBeUndefined();
  });
});
