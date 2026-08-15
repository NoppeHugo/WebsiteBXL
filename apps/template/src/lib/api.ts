/**
 * Adresse de l'API maison, injectée au build par `PUBLIC_API_URL`.
 *
 * Absente, les formulaires qui en dépendent ne sont pas rendus du tout : un
 * formulaire pointant vers le vide perdrait silencieusement les demandes des
 * clients du salon.
 */
const base = (import.meta.env.PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export const apiConfigured = base.length > 0;

export function apiEndpoint(path: string): string | undefined {
  return apiConfigured ? `${base}${path}` : undefined;
}
