import { describe, expect, it } from "vitest";
import { safeName } from "./media.ts";

/**
 * `safeName` est la barrière entre un nom de fichier venu de l'extérieur et
 * l'écriture sur disque. Un nom fabriqué ne doit jamais pouvoir désigner un
 * emplacement hors du dossier du client.
 */
describe("safeName", () => {
  it("normalise un nom d'appareil photo", () => {
    expect(safeName("IMG_4821.HEIC")).toBe("img-4821.jpg");
  });

  it("retire les accents et la ponctuation", () => {
    expect(safeName("Salon — Été 2026 (retouché).png")).toBe(
      "salon-ete-2026-retouche.jpg",
    );
  });

  it("neutralise une tentative de remontée de dossier", () => {
    expect(safeName("../../../etc/passwd")).toBe("passwd.jpg");
    expect(safeName("/etc/shadow")).toBe("shadow.jpg");
    expect(safeName("..")).toBeUndefined();
  });

  it("refuse un nom qui ne laisse rien d'exploitable", () => {
    expect(safeName("###.jpg")).toBeUndefined();
    expect(safeName("   ")).toBeUndefined();
    expect(safeName("")).toBeUndefined();
  });

  it("borne la longueur", () => {
    const name = safeName(`${"a".repeat(200)}.jpg`);
    expect(name!.length).toBeLessThanOrEqual(64);
  });

  it("force l'extension jpg quelle que soit l'entrée", () => {
    expect(safeName("photo.png")).toBe("photo.jpg");
    expect(safeName("photo.webp")).toBe("photo.jpg");
  });
});
