import { randomUUID } from "node:crypto";
import { SiteConfig } from "@bxl/schema";

/**
 * Dupliquer un site pour en faire la base d'un autre.
 *
 * Le contenu se reprend, l'identité jamais.
 *
 * ─── Ce qui est régénéré, et pourquoi ce n'est pas négociable ─────────────
 *
 * Le `tenantId` d'abord. C'est la clé sous laquelle l'API range les
 * rendez-vous, les messages et les commandes. Deux sites qui la partagent ne
 * produisent aucune erreur : ils reçoivent simplement le courrier l'un de
 * l'autre, et le salon d'en face lit les demandes de son voisin. On ne peut
 * pas laisser ce champ au hasard d'une relecture.
 *
 * ─── Ce qui est effacé ────────────────────────────────────────────────────
 *
 * Trois familles de données appartiennent au commerce d'origine et à personne
 * d'autre :
 *
 *  - **les avis.** Les recopier publierait des témoignages qu'aucun client de
 *    ce commerce-ci n'a écrits. Ce n'est pas une négligence, c'est un faux ;
 *  - **les mentions légales** — numéro d'entreprise, TVA, dénomination. Les
 *    garder ferait porter au nouveau site l'identité juridique d'une autre
 *    société ;
 *  - **les liens Google** — fiche et identifiant de lieu. Ils partent dans les
 *    données structurées : un site qui déclare le `placeId` du voisin dit à
 *    Google qu'il *est* le voisin.
 *
 * Aucune de ces trois n'échouerait bruyamment. Elles seraient simplement
 * fausses, et découvertes tard.
 *
 * ─── Ce qui est conservé ──────────────────────────────────────────────────
 *
 * Tout le reste : textes, horaires, prestations, galerie, équipe, déroulé,
 * sections du métier, et le thème. C'est ce qui fait l'intérêt de la
 * manœuvre — repartir d'un site abouti plutôt que d'une page vide.
 *
 * ─── Ce qui reste à la charge de l'exploitant ─────────────────────────────
 *
 * Le téléphone, l'e-mail et l'adresse sont **recopiés**, volontairement : ils
 * servent de repère pour la saisie, et un formulaire de contact sans
 * destinataire est refusé plus loin dans la chaîne. Mais ils désignent encore
 * l'autre commerce, et `resteAFaire()` les réclame tant qu'ils n'ont pas
 * changé. Le site reste en brouillon jusqu'à la mise en ligne, donc hors ligne
 * pendant tout ce temps.
 */

export interface Duplication {
  slug: string;
  nom: string;
  domaine: string;
}

export interface Copie {
  site: Record<string, unknown>;
  tenantId: string;
  /** Ce qui a été retiré, à dire à l'exploitant plutôt qu'à taire. */
  retire: string[];
}

export function dupliquer(
  source: Record<string, unknown>,
  vers: Duplication,
): Copie {
  // Copie profonde : sans elle, modifier la copie retoucherait le modèle, et
  // deux sites partageraient leurs sous-objets jusqu'au prochain écriture.
  const site = structuredClone(source);
  const retire: string[] = [];

  site.slug = vers.slug;
  site.domain = vers.domaine;
  // Les alias appartiennent au domaine d'origine : les reprendre ferait
  // rediriger le site du modèle vers la copie.
  site.aliases = [];

  /*
   * Brouillon, toujours. Rien n'est servi, aucun bloc nginx n'est posé, aucun
   * certificat demandé : c'est ce qui laisse le temps de corriger tout ce qui
   * désigne encore l'autre commerce.
   */
  site.status = "draft";
  site.demo = false;

  const tenantId = randomUUID();
  site.tenantId = tenantId;

  const business = site.business as Record<string, unknown>;
  business.name = vers.nom;

  if (business.googleMapsUrl || business.googlePlaceId) {
    delete business.googleMapsUrl;
    delete business.googlePlaceId;
    retire.push("les liens vers la fiche Google");
  }
  // Les réseaux sociaux sont ceux du modèle : un compte Instagram ne se
  // partage pas entre deux commerces.
  const social = business.social as Record<string, unknown> | undefined;
  if (social && Object.keys(social).length > 0) {
    business.social = {};
    retire.push("les réseaux sociaux");
  }

  if (Array.isArray(site.reviews) && site.reviews.length > 0) {
    retire.push(`les ${site.reviews.length} avis`);
    site.reviews = [];
  }

  if (site.legal) {
    delete site.legal;
    retire.push("les mentions légales");
  }

  /*
   * Le titre d'accueil reprend le nom du nouveau commerce quand il ne portait
   * que celui de l'ancien. S'il s'agissait d'une vraie accroche — « Coiffeur à
   * Saint-Gilles depuis 1998 » — on n'y touche pas : c'est du contenu, et
   * c'est justement ce qu'on vient chercher en dupliquant.
   */
  const hero = site.hero as Record<string, unknown>;
  const ancienNom = String((source.business as Record<string, unknown>).name);
  const titres = hero.headline as Record<string, string>;
  for (const [langue, texte] of Object.entries(titres)) {
    if (texte.trim() === ancienNom) titres[langue] = vers.nom;
  }

  return { site, tenantId, retire };
}

/** Valide la copie avec le même schéma que le build. */
export function validerCopie(
  site: Record<string, unknown>,
): { ok: true } | { ok: false; erreurs: string[] } {
  const parsed = SiteConfig.safeParse(site);
  if (parsed.success) return { ok: true };
  return {
    ok: false,
    erreurs: parsed.error.issues.map(
      (i) => `${i.path.join(".") || "(racine)"} — ${i.message}`,
    ),
  };
}

/**
 * Les coordonnées que ce site partage encore avec un autre.
 *
 * Le danger propre à la duplication : le téléphone et l'e-mail sont recopiés
 * volontairement — ils servent de repère à la saisie — mais désignent l'autre
 * commerce tant qu'on ne les a pas changés. Publié tel quel, le site enverrait
 * les demandes de contact au voisin, et afficherait son numéro.
 *
 * Rien ne le signalerait : les deux valeurs sont parfaitement valides. Seule
 * la comparaison avec les autres clients peut le dire.
 *
 * Les numéros sont comparés sur leur valeur, pas sur leur écriture :
 * « +32 2 111 11 11 » et « 02/111.11.11 » désignent le même poste. Le cas
 * arrive tout seul — on recopie le numéro depuis la fiche Google du commerce,
 * qui l'écrit dans l'autre format, et une comparaison littérale conclurait
 * qu'il a été corrigé.
 *
 * La règle du préfixe est belge, comme tout le reste du projet.
 */
export function coordonneesPartagees(
  site: { business: { phone: string; email?: string } },
  autres: Array<{ slug: string; nom: string; phone: string; email?: string }>,
): string[] {
  const normaliser = (v: string | undefined) => {
    const nu = (v ?? "").toLowerCase().replace(/[\s.()/-]/g, "");
    // Indicatif international ramené à la forme nationale : +32 2 … et 02 …
    // sont le même numéro.
    return nu.replace(/^(\+32|0032)/, "0");
  };

  const telephone = normaliser(site.business.phone);
  const courriel = normaliser(site.business.email);
  const partages: string[] = [];

  for (const autre of autres) {
    const memes: string[] = [];
    if (telephone && normaliser(autre.phone) === telephone) memes.push("le téléphone");
    if (courriel && normaliser(autre.email) === courriel) memes.push("l'e-mail");
    if (memes.length > 0) partages.push(`${memes.join(" et ")} de ${autre.nom}`);
  }
  return partages;
}
