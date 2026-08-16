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
  // Le driver `smtp` charge nodemailer par un import dynamique : sans vider le
  // cache des modules, le doublure d'un test resservirait au suivant.
  vi.resetModules();
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

describe("mode smtp", () => {
  const smtp = {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    user: "salon@gmail.com",
    pass: "mot-de-passe-application",
  };

  it("refuse de se construire sans paramètres de connexion", () => {
    // Sans cela, l'absence de configuration ne se verrait qu'au premier
    // courriel — c'est-à-dire au premier client, en production.
    expect(() => createMailer({ driver: "smtp" })).toThrow(/smtp/);
  });

  it("ouvre la connexion avec les paramètres reçus et transmet le courriel", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const createTransport = vi.fn().mockReturnValue({ sendMail });
    vi.doMock("nodemailer", () => ({ default: { createTransport } }));

    await createMailer({ driver: "smtp", smtp, from: "Salon <salon@gmail.com>" })(mail);

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Salon <salon@gmail.com>",
        to: "sophie@exemple.be",
        subject: "Rendez-vous confirmé",
      }),
    );
  });

  it("n'ouvre qu'une seule connexion pour plusieurs courriels", async () => {
    // Une session TLS par courriel serait payée à chaque confirmation.
    const sendMail = vi.fn().mockResolvedValue({});
    const createTransport = vi.fn().mockReturnValue({ sendMail });
    vi.doMock("nodemailer", () => ({ default: { createTransport } }));

    const envoyer = createMailer({ driver: "smtp", smtp });
    await envoyer(mail);
    await envoyer(mail);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("n'invente pas de champ de réponse quand il n'y en a pas", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    vi.doMock("nodemailer", () => ({
      default: { createTransport: () => ({ sendMail }) },
    }));

    await createMailer({ driver: "smtp", smtp })(mail);

    expect("replyTo" in sendMail.mock.calls[0]![0]).toBe(false);
  });

  it("échoue bruyamment quand le relais refuse", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("535 authentification refusée"));
    vi.doMock("nodemailer", () => ({
      default: { createTransport: () => ({ sendMail }) },
    }));

    await expect(createMailer({ driver: "smtp", smtp })(mail)).rejects.toThrow(/535/);
  });
});
