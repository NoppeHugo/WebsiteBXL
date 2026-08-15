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

/**
 * Où renvoyer un visiteur sans JavaScript après un envoi.
 *
 * L'adresse annoncée par le formulaire est vérifiée ; refusée ou absente, on
 * retombe sur l'origine déclarée du commerce plutôt que sur rien. « Rien »
 * signifiait jusqu'ici afficher du JSON brut sur le domaine de l'API à
 * quelqu'un qui venait simplement d'écrire au salon — le cas se produit dès
 * que l'adresse du site et l'origine enregistrée divergent d'un « www ».
 *
 * Le refus est journalisé : retomber silencieusement sur l'origine masquerait
 * la configuration fautive, qui mérite d'être corrigée.
 */
export function returnTo(
  request: FastifyRequest,
  redirectTo: string | undefined,
  origin: string,
): string {
  const safe = safeRedirect(redirectTo, origin);
  if (safe) return safe;
  if (redirectTo) {
    request.log.warn(
      { redirectTo, origin },
      "adresse de retour refusée — repli sur l'origine du commerce",
    );
  }
  return origin;
}

/*
 * Ancres de retour. Le site les porte en dur et les révèle par `:target`,
 * c'est-à-dire sans JavaScript — ce qui compte, puisque seuls les visiteurs
 * qui en sont dépourvus empruntent ce chemin. Le paramètre `sent` reste posé
 * pour les rares navigateurs qui ont JavaScript mais pas `fetch`.
 */
const ANCHOR_OK = "envoi-ok";
const ANCHOR_ERROR = "envoi-ko";

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
  url.hash = ANCHOR_OK;
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
  url.hash = ANCHOR_ERROR;
  return reply.redirect(url.href, 303);
}
