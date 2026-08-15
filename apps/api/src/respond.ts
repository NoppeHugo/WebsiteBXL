import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Le même point d'entrée sert deux clients : le formulaire amélioré par
 * `fetch`, qui attend du JSON, et l'envoi HTML classique quand JavaScript
 * n'est pas disponible, qui attend une redirection.
 */
export function wantsJson(request: FastifyRequest): boolean {
  const accept = String(request.headers.accept ?? "");
  return accept.includes("application/json");
}

/**
 * Valide une URL de retour contre l'origine déclarée du client.
 *
 * Sans ce contrôle, l'API redirigerait vers n'importe quelle adresse fournie
 * dans le formulaire : une redirection ouverte, idéale pour du hameçonnage au
 * nom du salon.
 */
export function safeRedirect(
  redirectTo: string | undefined,
  origin: string,
): string | undefined {
  if (!redirectTo) return undefined;
  try {
    const target = new URL(redirectTo);
    const allowed = new URL(origin);
    if (target.origin !== allowed.origin) return undefined;
    return target.href;
  } catch {
    return undefined;
  }
}

export function ok(
  request: FastifyRequest,
  reply: FastifyReply,
  redirectTo: string | undefined,
): FastifyReply {
  if (wantsJson(request) || !redirectTo) {
    return reply.code(200).send({ ok: true });
  }
  const url = new URL(redirectTo);
  url.searchParams.set("sent", "1");
  return reply.redirect(url.href, 303);
}

export function rejected(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  message: string,
  redirectTo?: string,
): FastifyReply {
  if (wantsJson(request) || !redirectTo) {
    return reply.code(status).send({ ok: false, error: message });
  }
  const url = new URL(redirectTo);
  url.searchParams.set("sent", "0");
  return reply.redirect(url.href, 303);
}
