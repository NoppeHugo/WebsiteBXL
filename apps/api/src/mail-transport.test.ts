import { describe, expect, it, vi, afterEach } from "vitest";
import { createMailer } from "./mail-transport.ts";

/**
 * Le transport ne lit aucune variable d'environnement : ces tests s'exécutent
 * donc sans configuration, ce qui est précisément l'intérêt de l'avoir séparé
 * de `mail.ts` (README §3.5 bis).
 */

const mail = {
  to: "sophie@exemple.be",
  subject: "Rendez-vous confirmé",
  text: "À mardi.",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mode log", () => {
  it("écrit dans la console sans appeler le réseau", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await createMailer({ driver: "log" })(mail);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls[0]![0]).toContain("sophie@exemple.be");
  });
});

describe("mode resend", () => {
  it("transmet expéditeur, destinataire et clé", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await createMailer({
      driver: "resend",
      apiKey: "clé-secrète",
      from: "Réservations <no-reply@exemple.be>",
    })({ ...mail, replyTo: "salon@exemple.be" });

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const headers = (init!.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe("Bearer clé-secrète");

    const body = JSON.parse(String(init!.body));
    expect(body.from).toBe("Réservations <no-reply@exemple.be>");
    expect(body.to).toEqual(["sophie@exemple.be"]);
    // Resend attend `reply_to`, pas `replyTo` : c'est ce qui permet au salon
    // de répondre directement au client depuis sa boîte.
    expect(body.reply_to).toBe("salon@exemple.be");
  });

  it("n'invente pas de champ de réponse quand il n'y en a pas", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await createMailer({ driver: "resend", apiKey: "k" })(mail);

    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]!.body));
    expect("reply_to" in body).toBe(false);
  });

  it("échoue bruyamment sur un refus", async () => {
    // L'appelant décide quoi faire de l'échec — l'API n'annule pas un
    // rendez-vous parce qu'un courriel n'est pas parti. Encore faut-il qu'il
    // le sache.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("clé invalide", { status: 401 }),
    );

    await expect(
      createMailer({ driver: "resend", apiKey: "mauvaise" })(mail),
    ).rejects.toThrow(/401/);
  });
});
