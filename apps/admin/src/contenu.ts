import { LANGUAGES } from "@bxl/schema";

/**
 * Application des champs de l'éditeur sur `site.json`.
 *
 * Le formulaire envoie des noms à plat — « gallery.2.alt.fr » — et cette
 * couche les repose dans la structure du fichier. Elle est séparée des routes
 * pour être vérifiable sans serveur ni base : c'est ici que se joue la
 * différence entre corriger un titre et effacer une traduction.
 *
 * Principe directeur : **ne toucher qu'aux clés de la section enregistrée**.
 * Le fichier contient des données qu'aucun formulaire n'expose — identifiants,
 * coordonnées géographiques, thème — et une section qui réécrirait l'objet
 * entier les emporterait sans que rien ne le signale.
 */

export type Champs = Record<string, string | undefined>;

/** Un texte traduit, reconstruit depuis « prefixe.fr », « prefixe.nl »… */
export function texteTraduit(champs: Champs, prefixe: string): Record<string, string> {
  const resultat: Record<string, string> = {};
  for (const langue of LANGUAGES) {
    const valeur = (champs[`${prefixe}.${langue}`] ?? "").trim();
    // Une langue laissée vide est absente, pas vide : le schéma refuse la
    // chaîne vide, et une clé vide vaudrait « traduit par du rien ».
    if (valeur) resultat[langue] = valeur;
  }
  return resultat;
}

/**
 * Les indices présents pour un préfixe donné, dans l'ordre du formulaire.
 *
 * Le navigateur renumérote avant l'envoi, mais un formulaire posté sans
 * JavaScript — ou une requête forgée — peut sauter des indices. Les trier ici
 * évite qu'un trou décale tout le reste.
 */
export function indices(champs: Champs, prefixe: string): number[] {
  const vus = new Set<number>();
  const motif = new RegExp(`^${prefixe}\\.(\\d+)\\.`);
  for (const cle of Object.keys(champs)) {
    const trouve = motif.exec(cle);
    if (trouve) vus.add(Number(trouve[1]));
  }
  return [...vus].sort((a, b) => a - b);
}

function objet(raw: Record<string, unknown>, cle: string): Record<string, unknown> {
  const valeur = raw[cle];
  if (typeof valeur === "object" && valeur !== null) return valeur as Record<string, unknown>;
  const cree: Record<string, unknown> = {};
  raw[cle] = cree;
  return cree;
}

/** Écrit la valeur, ou retire la clé si elle est vide. */
function poser(cible: Record<string, unknown>, cle: string, valeur: string | undefined): void {
  const propre = (valeur ?? "").trim();
  if (propre) cible[cle] = propre;
  else delete cible[cle];
}

/** Idem pour un texte traduit : un objet vide est retiré. */
function poserTraduit(
  cible: Record<string, unknown>,
  cle: string,
  champs: Champs,
  prefixe: string,
  { obligatoire = false } = {},
): void {
  const texte = texteTraduit(champs, prefixe);
  if (Object.keys(texte).length > 0) cible[cle] = texte;
  // Un champ obligatoire vidé est laissé tel quel plutôt que supprimé : la
  // validation refusera l'enregistrement avec un message, au lieu de produire
  // un fichier auquel il manque une clé attendue.
  else if (!obligatoire) delete cible[cle];
  else cible[cle] = texte;
}

export const SECTIONS = [
  "accueil",
  "presentation",
  "galerie",
  "equipe",
  "avis",
  "prestations",
  "referencement",
] as const;

export type Section = (typeof SECTIONS)[number];

export function estSection(valeur: string): valeur is Section {
  return (SECTIONS as readonly string[]).includes(valeur);
}

/**
 * Applique une section sur le contenu brut. Modifie `raw` sur place.
 */
export function appliquerSection(
  raw: Record<string, unknown>,
  section: Section,
  champs: Champs,
): void {
  switch (section) {
    case "accueil": {
      const hero = objet(raw, "hero");
      poser(hero, "image", champs["hero.image"]);
      poserTraduit(hero, "headline", champs, "hero.headline", { obligatoire: true });
      poserTraduit(hero, "subline", champs, "hero.subline");
      return;
    }

    case "presentation": {
      const business = objet(raw, "business");
      poser(business, "name", champs["business.name"]);
      poserTraduit(business, "tagline", champs, "business.tagline");
      poserTraduit(business, "description", champs, "business.description", {
        obligatoire: true,
      });
      poser(business, "phone", champs["business.phone"]);
      poser(business, "email", champs["business.email"]);

      const adresse = objet(business, "address");
      poser(adresse, "street", champs["business.address.street"]);
      poser(adresse, "postalCode", champs["business.address.postalCode"]);
      poser(adresse, "city", champs["business.address.city"]);

      const social = objet(business, "social");
      for (const reseau of ["instagram", "facebook", "tiktok"]) {
        poser(social, reseau, champs[`business.social.${reseau}`]);
      }
      return;
    }

    case "galerie": {
      raw.gallery = indices(champs, "gallery")
        .map((i) => ({
          src: (champs[`gallery.${i}.src`] ?? "").trim(),
          alt: texteTraduit(champs, `gallery.${i}.alt`),
        }))
        // Un emplacement dont l'image a été retirée sans qu'une autre soit
        // déposée disparaît de la galerie : le conserver produirait une photo
        // sans fichier, et le site refuserait de se construire.
        .filter((photo) => photo.src.length > 0);
      return;
    }

    case "equipe": {
      raw.team = indices(champs, "team")
        .map((i) => {
          const membre: Record<string, unknown> = {
            name: (champs[`team.${i}.name`] ?? "").trim(),
          };
          const role = texteTraduit(champs, `team.${i}.role`);
          if (Object.keys(role).length > 0) membre.role = role;
          const photo = (champs[`team.${i}.photo`] ?? "").trim();
          if (photo) membre.photo = photo;
          return membre;
        })
        // Une personne sans nom est une ligne ajoutée puis abandonnée.
        .filter((membre) => String(membre.name).length > 0);
      return;
    }

    case "avis": {
      raw.reviews = indices(champs, "reviews")
        .map((i) => ({
          author: (champs[`reviews.${i}.author`] ?? "").trim(),
          rating: Number(champs[`reviews.${i}.rating`] ?? 5),
          text: texteTraduit(champs, `reviews.${i}.text`),
          source: champs[`reviews.${i}.source`] ?? "google",
        }))
        .filter((avis) => avis.author.length > 0);
      return;
    }

    case "prestations": {
      const services = (raw.services as Array<Record<string, unknown>>) ?? [];
      for (const [position, i] of indices(champs, "services").entries()) {
        // Retrouvé par identifiant et non par position : des rendez-vous déjà
        // pris s'y réfèrent, et un décalage d'indice les rattacherait à une
        // autre prestation.
        const id = champs[`services.${i}.id`];
        const service = services.find((s) => s.id === id) ?? services[position];
        if (!service) continue;

        const nom = texteTraduit(champs, `services.${i}.name`);
        if (Object.keys(nom).length > 0) service.name = nom;

        const duree = champs[`services.${i}.durationMin`];
        if (duree) service.durationMin = Number(duree);

        const prix = champs[`services.${i}.price`];
        service.price = prix === undefined || prix.trim() === "" ? null : Number(prix);
        service.priceFrom = Boolean(champs[`services.${i}.priceFrom`]);
      }
      return;
    }

    case "referencement": {
      const seo = objet(raw, "seo");
      poserTraduit(seo, "title", champs, "seo.title");
      poserTraduit(seo, "description", champs, "seo.description");
      return;
    }
  }
}
