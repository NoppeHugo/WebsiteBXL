import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sql, findTenant } from "../db.ts";
import {
  saltForToday,
  visitorHash,
  deviceFrom,
  referrerHost,
} from "../analytics.ts";

const Event = z.object({
  tenantId: z.string().uuid(),
  kind: z.enum(["view", "call", "directions", "booking", "contact", "social"]),
  path: z.string().max(200).default("/"),
  lang: z.enum(["fr", "nl", "en"]).default("fr"),
  referrer: z.string().max(500).optional(),
});

/**
 * Collecte d'audience.
 *
 * Volontairement muette : elle répond toujours 204, quoi qu'il arrive. Un
 * visiteur du salon ne doit jamais voir une erreur de mesure, et un échec de
 * collecte ne vaut pas la peine d'être signalé à qui que ce soit.
 */
export function collectRoutes(app: FastifyInstance): void {
  app.post("/v1/collect", {
    config: {
      // Bien plus permissif que les formulaires : ce sont des visites, pas des
      // envois. La limite existe seulement pour borner un script emballé.
      rateLimit: { max: 240, timeWindow: "10 minutes" },
    },
    handler: async (request, reply) => {
      const parsed = Event.safeParse(request.body);
      if (!parsed.success) return reply.code(204).send();

      const event = parsed.data;

      try {
        const tenant = await findTenant(event.tenantId);
        if (!tenant) return reply.code(204).send();

        const salt = await saltForToday(sql);
        const userAgent = String(request.headers["user-agent"] ?? "");

        await sql`
          insert into page_events (
            tenant_id, kind, path, lang, referrer, device, visitor_hash
          ) values (
            ${tenant.id}, ${event.kind}, ${event.path}, ${event.lang},
            ${referrerHost(event.referrer) ?? null}, ${deviceFrom(userAgent)},
            ${visitorHash({ salt, ip: request.ip, userAgent, tenantId: tenant.id })}
          )
        `;
      } catch (error) {
        request.log.warn({ err: error }, "événement d'audience non enregistré");
      }

      return reply.code(204).send();
    },
  });
}
