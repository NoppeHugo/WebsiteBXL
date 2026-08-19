import { LANGUAGES, WEEKDAYS } from "@bxl/schema";
import { parseSlots } from "./hours.ts";

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

/**
 * Un identifiant de prestation dérivé de son nom, unique dans la liste.
 *
 * Le schéma n'accepte que minuscules, chiffres et tirets. « Coupe & barbe »
 * donne « coupe-barbe » ; un second du même nom donne « coupe-barbe-2 » plutôt
 * que d'écraser le premier.
 */
function identifiantLibre(nom: string, pris: Set<string>): string {
  const base =
    nom
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "prestation";

  if (!pris.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const essai = `${base}-${n}`;
    if (!pris.has(essai)) return essai;
  }
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
  "horaires",
  "fermetures",
  "galerie",
  "deroule",
  "equipe",
  "avis",
  "prestations",
  /* --- Fleuriste. Ignorées par les autres métiers, qui ne les affichent pas. --- */
  "occasions",
  "livraison",
  "deuil",
  "abonnements",
  /* --- Restauration et salles de cours. --- */
  "carte",
  "planning",
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

    case "horaires": {
      const heures: Record<string, unknown> = {};
      for (const jour of WEEKDAYS) {
        // Un jour absent du formulaire est fermé, pas inchangé : c'est ainsi
        // qu'une case vidée ferme réellement la journée.
        heures[jour] = parseSlots(champs[`hours.${jour}`] ?? "");
      }
      raw.hours = heures;
      return;
    }

    case "fermetures": {
      /*
       * Congés et fermetures exceptionnelles.
       *
       * C'est la modification la plus urgente qu'un commerçant ait à faire, et
       * la seule qui ait un effet immédiat sur la réservation : une fermeture
       * enregistrée retire les créneaux du jour même, avant toute
       * reconstruction du site.
       *
       * Les dates passées sont conservées telles quelles. Les purger
       * paraîtrait propre, mais une fermeture d'il y a trois jours explique
       * l'agenda vide de la semaine dernière — et c'est la question qu'on pose.
       */
      raw.closures = indices(champs, "closures")
        .map((i) => {
          const du = (champs[`closures.${i}.from`] ?? "").trim();
          // Une fermeture d'un seul jour ne demande pas de saisir deux fois la
          // même date : la fin vide vaut « le même jour ».
          const au = (champs[`closures.${i}.to`] ?? "").trim() || du;
          const fermeture: Record<string, unknown> = { from: du, to: au };
          const motif = texteTraduit(champs, `closures.${i}.reason`);
          if (Object.keys(motif).length > 0) fermeture.reason = motif;
          return fermeture;
        })
        .filter((f) => String(f.from).length > 0)
        // Triées : la liste est lue pour savoir « quand suis-je fermé ? », et
        // une liste dans l'ordre de saisie ne répond pas à cette question.
        .sort((a, b) => String(a.from).localeCompare(String(b.from)));
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

    case "deroule": {
      raw.steps = indices(champs, "steps")
        .map((i) => {
          const etape: Record<string, unknown> = {
            title: texteTraduit(champs, `steps.${i}.title`),
            photo: (champs[`steps.${i}.photo`] ?? "").trim(),
          };
          const texte = texteTraduit(champs, `steps.${i}.text`);
          if (Object.keys(texte).length > 0) etape.text = texte;
          return etape;
        })
        // Une étape sans photo ou sans titre est une ligne ajoutée puis
        // abandonnée : la garder ferait échouer la construction du site.
        .filter(
          (etape) =>
            String(etape.photo).length > 0 &&
            Object.keys(etape.title as object).length > 0,
        );
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
      const existants = (raw.services as Array<Record<string, unknown>>) ?? [];
      const pris = new Set(existants.map((s) => String(s.id)));

      const suivants = indices(champs, "services")
        .map((i) => {
          const nom = texteTraduit(champs, `services.${i}.name`);
          // Une ligne sans nom est une ligne ajoutée puis abandonnée.
          if (Object.keys(nom).length === 0) return undefined;

          /*
           * L'identifiant est stable et ne se recalcule jamais.
           *
           * Les rendez-vous déjà pris le portent en clair. Le régénérer à
           * partir du nom — parce qu'on a corrigé une faute de frappe —
           * détacherait les rendez-vous existants de leur prestation, sans
           * erreur visible : ils resteraient au calendrier, orphelins.
           */
          const fourni = (champs[`services.${i}.id`] ?? "").trim();
          const connu = fourni ? existants.find((s) => s.id === fourni) : undefined;

          /*
           * Un identifiant inconnu ne devient jamais l'identifiant de la
           * prestation : on en fabrique un. Le champ est caché dans le
           * formulaire, donc un identifiant qui ne correspond à rien vient
           * d'une requête forgée ou d'un envoi périmé — dans les deux cas, le
           * reprendre tel quel laisserait quelqu'un d'autre choisir la clé à
           * laquelle des rendez-vous se rattacheront.
           */
          const service = connu ?? { id: identifiantLibre(Object.values(nom)[0]!, pris) };

          pris.add(String(service.id));
          service.name = nom;

          const duree = Number(champs[`services.${i}.durationMin`] ?? "");
          // Une durée absente ou absurde vaut trente minutes plutôt que zéro :
          // une durée nulle fait proposer des créneaux qui se chevauchent tous.
          service.durationMin = Number.isFinite(duree) && duree > 0 ? duree : 30;

          const prix = (champs[`services.${i}.price`] ?? "").trim();
          // Vide vaut « sur devis », pas « gratuit ». La virgule décimale est
          // ce qu'un clavier belge produit : la refuser afficherait 0 €.
          const montant = Number(prix.replace(",", "."));
          service.price = prix === "" || !Number.isFinite(montant) ? null : montant;
          service.priceFrom = Boolean(champs[`services.${i}.priceFrom`]);

          return service;
        })
        .filter((s): s is Record<string, unknown> => s !== undefined);

      /*
       * Absente du formulaire, une prestation est supprimée — comme pour les
       * horaires et la galerie. Le formulaire renvoie toujours la liste
       * complète ; l'omission est donc un retrait voulu.
       *
       * Les rendez-vous déjà pris n'en souffrent pas : ils gardent le nom de la
       * prestation en clair à côté de son identifiant, précisément pour que
       * l'historique survive à une carte des tarifs qui change.
       */
      raw.services = suivants;
      return;
    }

    case "occasions": {
      /*
       * Même règle que la galerie : la liste complète est renvoyée, l'absence
       * vaut retrait. L'identifiant se dérive du titre quand il manque, et ne
       * se recalcule jamais ensuite — rien ne s'y réfère aujourd'hui, mais une
       * commande passée le porte, et une occasion renommée en janvier ne doit
       * pas rendre illisible une commande de la Toussaint.
       */
      const existantes = (raw.occasions as Array<Record<string, unknown>>) ?? [];
      const pris = new Set(existantes.map((o) => String(o.id)));

      raw.occasions = indices(champs, "occasions")
        .map((i) => {
          const titre = texteTraduit(champs, `occasions.${i}.title`);
          if (Object.keys(titre).length === 0) return undefined;

          const fourni = (champs[`occasions.${i}.id`] ?? "").trim();
          const connue = fourni ? existantes.find((o) => o.id === fourni) : undefined;
          const occasion = connue ?? {
            id: identifiantLibre(Object.values(titre)[0]!, pris),
          };
          pris.add(String(occasion.id));

          occasion.title = titre;
          const texte = texteTraduit(champs, `occasions.${i}.text`);
          if (Object.keys(texte).length > 0) occasion.text = texte;
          else delete occasion.text;

          const photo = (champs[`occasions.${i}.photo`] ?? "").trim();
          if (photo) occasion.photo = photo;
          else delete occasion.photo;

          const prix = (champs[`occasions.${i}.price`] ?? "").trim();
          const montant = Number(prix.replace(",", "."));
          occasion.price = prix === "" || !Number.isFinite(montant) ? null : montant;

          return occasion;
        })
        .filter((o): o is Record<string, unknown> => o !== undefined);
      return;
    }

    case "carte": {
      /*
       * La carte, saisie à plat et rangée en groupes ici.
       *
       * Le formulaire montre une ligne par plat, avec le nom de son groupe —
       * exactement comme la catégorie d'une prestation. C'est le même geste
       * que recopier une carte sur une feuille, et cela évite au commerçant
       * d'ouvrir un groupe avant de pouvoir écrire un plat. Le fichier, lui,
       * garde des groupes : ce sont eux que la page affiche, avec leur ordre.
       *
       * L'ordre des groupes est celui de leur première apparition. Un plat
       * déplacé d'un groupe à l'autre suffit donc à réorganiser la carte, sans
       * qu'aucun bouton « monter / descendre » soit nécessaire.
       */
      poserTraduit(raw, "menuNote", champs, "menuNote");

      const langueSite = String(
        (raw.languages as { default?: unknown } | undefined)?.default ?? "fr",
      );
      const GROUPE_SANS_NOM: Record<string, string> = {
        fr: "La carte",
        nl: "De kaart",
        en: "The menu",
      };

      const anciensGroupes = (raw.menu as Array<Record<string, unknown>>) ?? [];
      const prisGroupes = new Set(anciensGroupes.map((g) => String(g.id)));
      const parLibelle = new Map<string, Record<string, unknown>>();
      const ordre: Array<Record<string, unknown>> = [];
      let dernierTitre: Record<string, string> | undefined;

      const TAGS = ["vegetarien", "vegan", "sans-gluten", "epice", "maison"] as const;

      for (const i of indices(champs, "carte")) {
        const nom = texteTraduit(champs, `carte.${i}.name`);
        // Une ligne sans nom est une ligne ajoutée puis abandonnée.
        if (Object.keys(nom).length === 0) continue;

        /*
         * Un groupe laissé vide reprend celui de la ligne précédente : on
         * saisit une carte de haut en bas, et retaper « Entrées » sur chaque
         * ligne est le genre de corvée qui fait renoncer à tenir sa carte à
         * jour — c'est-à-dire l'argument de vente du site.
         */
        let titre = texteTraduit(champs, `carte.${i}.group`);
        if (Object.keys(titre).length === 0) {
          titre = dernierTitre ?? { [langueSite]: GROUPE_SANS_NOM[langueSite] ?? "Carte" };
        }
        dernierTitre = titre;

        const libelle = (Object.values(titre)[0] ?? "").toLowerCase();
        let groupe = parLibelle.get(libelle);
        if (!groupe) {
          /*
           * Un groupe déjà connu garde son identifiant et sa note : la note
           * (« servi le midi en semaine ») n'est pas dans ce formulaire, et
           * régénérer le groupe l'effacerait sans que rien ne le dise.
           */
          const connu = anciensGroupes.find(
            (g) =>
              (Object.values((g.title as Record<string, string>) ?? {})[0] ?? "").toLowerCase() ===
              libelle,
          );
          groupe = connu
            ? { ...connu }
            : { id: identifiantLibre(Object.values(titre)[0]!, prisGroupes) };
          prisGroupes.add(String(groupe.id));
          groupe.title = titre;
          groupe.items = [];
          parLibelle.set(libelle, groupe);
          ordre.push(groupe);
        }

        const plat: Record<string, unknown> = { name: nom };

        const description = texteTraduit(champs, `carte.${i}.description`);
        if (Object.keys(description).length > 0) plat.description = description;

        // Vide vaut « selon arrivage », pas « gratuit ». La virgule décimale
        // est ce que produit un clavier belge.
        const prix = (champs[`carte.${i}.price`] ?? "").trim();
        const montant = Number(prix.replace(",", "."));
        plat.price = prix === "" || !Number.isFinite(montant) ? null : montant;

        const tags = TAGS.filter((tag) => Boolean(champs[`carte.${i}.tags.${tag}`]));
        if (tags.length > 0) plat.tags = tags;

        (groupe.items as Array<Record<string, unknown>>).push(plat);
      }

      raw.menu = ordre;
      return;
    }

    case "planning": {
      /*
       * Le planning des cours. Même règle que partout : la liste complète est
       * renvoyée, l'absence vaut retrait.
       */
      const existants = (raw.courses as Array<Record<string, unknown>>) ?? [];
      const pris = new Set(existants.map((c) => String(c.id)));

      raw.courses = indices(champs, "courses")
        .map((i) => {
          const nom = texteTraduit(champs, `courses.${i}.name`);
          if (Object.keys(nom).length === 0) return undefined;

          const fourni = (champs[`courses.${i}.id`] ?? "").trim();
          const connu = fourni ? existants.find((c) => c.id === fourni) : undefined;
          const cours = connu ?? { id: identifiantLibre(Object.values(nom)[0]!, pris) };
          pris.add(String(cours.id));

          cours.name = nom;

          const jour = (champs[`courses.${i}.day`] ?? "").trim();
          cours.day = (WEEKDAYS as readonly string[]).includes(jour) ? jour : "monday";

          const heure = (valeur: string | undefined, defaut: string) =>
            /^([01]\d|2[0-3]):[0-5]\d$/.test((valeur ?? "").trim())
              ? (valeur ?? "").trim()
              : defaut;

          cours.start = heure(champs[`courses.${i}.start`], "18:00");
          /*
           * Une fin qui précède le début est refusée par le schéma, et le
           * message qui en sort ne veut rien dire pour un gérant de salle. On
           * ajoute une heure : le cours est visible, l'horaire se corrige d'un
           * clic, et personne ne perd sa saisie.
           */
          const fin = heure(champs[`courses.${i}.end`], "");
          cours.end =
            fin && fin > String(cours.start)
              ? fin
              : `${String(Math.min(23, Number(String(cours.start).slice(0, 2)) + 1)).padStart(2, "0")}${String(cours.start).slice(2)}`;

          const niveau = texteTraduit(champs, `courses.${i}.level`);
          if (Object.keys(niveau).length > 0) cours.level = niveau;
          else delete cours.level;

          poser(cours, "coach", champs[`courses.${i}.coach`]);

          const places = Number((champs[`courses.${i}.capacity`] ?? "").trim());
          if (Number.isFinite(places) && places > 0) cours.capacity = Math.round(places);
          else delete cours.capacity;

          return cours;
        })
        .filter((c): c is Record<string, unknown> => c !== undefined);
      return;
    }

    case "livraison": {
      /*
       * Une zone vide retire complètement la section : un fleuriste qui ne
       * livre pas ne doit pas afficher un encadré « Livraison » vide, et c'est
       * ainsi qu'il l'enlève — en vidant la liste des communes.
       */
      const zones = (champs["delivery.zones"] ?? "")
        .split(/[,\n]/)
        .map((z) => z.trim())
        .filter(Boolean);

      if (zones.length === 0) {
        delete raw.delivery;
        return;
      }

      const livraison = objet(raw, "delivery");
      livraison.zones = zones;
      poser(livraison, "cutoff", champs["delivery.cutoff"]);

      const frais = (champs["delivery.fee"] ?? "").trim();
      const montantFrais = Number(frais.replace(",", "."));
      livraison.fee = frais === "" || !Number.isFinite(montantFrais) ? null : montantFrais;

      const offert = (champs["delivery.freeFrom"] ?? "").trim();
      const montantOffert = Number(offert.replace(",", "."));
      if (offert !== "" && Number.isFinite(montantOffert)) livraison.freeFrom = montantOffert;
      else delete livraison.freeFrom;

      poserTraduit(livraison, "note", champs, "delivery.note");
      return;
    }

    case "deuil": {
      // Le texte commande la section : vidé, elle disparaît. C'est le seul
      // moyen simple de la retirer pour un commerce qui n'en veut pas.
      const texte = texteTraduit(champs, "mourning.text");
      if (Object.keys(texte).length === 0) {
        delete raw.mourning;
        return;
      }

      const deuil = objet(raw, "mourning");
      deuil.text = texte;
      poser(deuil, "phone", champs["mourning.phone"]);
      poser(deuil, "photo", champs["mourning.photo"]);
      deuil.venues = (champs["mourning.venues"] ?? "")
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean);
      return;
    }

    case "abonnements": {
      const existants = (raw.subscriptions as Array<Record<string, unknown>>) ?? [];
      const pris = new Set(existants.map((f) => String(f.id)));

      raw.subscriptions = indices(champs, "subscriptions")
        .map((i) => {
          const nom = texteTraduit(champs, `subscriptions.${i}.name`);
          if (Object.keys(nom).length === 0) return undefined;

          const fourni = (champs[`subscriptions.${i}.id`] ?? "").trim();
          const connu = fourni ? existants.find((f) => f.id === fourni) : undefined;
          const formule = connu ?? { id: identifiantLibre(Object.values(nom)[0]!, pris) };
          pris.add(String(formule.id));

          formule.name = nom;
          const rythme = texteTraduit(champs, `subscriptions.${i}.rhythm`);
          // Le rythme est obligatoire au schéma : le laisser vide ferait
          // échouer l'enregistrement avec un message technique. On reprend le
          // nom, qui dit déjà le rythme dans neuf cas sur dix.
          formule.rhythm = Object.keys(rythme).length > 0 ? rythme : nom;

          const texte = texteTraduit(champs, `subscriptions.${i}.text`);
          if (Object.keys(texte).length > 0) formule.text = texte;
          else delete formule.text;

          const prix = (champs[`subscriptions.${i}.price`] ?? "").trim();
          const montant = Number(prix.replace(",", "."));
          formule.price = prix === "" || !Number.isFinite(montant) ? null : montant;

          return formule;
        })
        .filter((f): f is Record<string, unknown> => f !== undefined);
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
