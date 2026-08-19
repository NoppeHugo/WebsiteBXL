import type { Language, SiteConfig } from "@bxl/schema";
import { escape } from "../views.ts";
import {
  texteTraduit,
  texte,
  emplacementPhoto,
  barreElement,
} from "./champs.ts";

/**
 * L'éditeur de contenu, une section par zone du site.
 *
 * Chaque section est un formulaire indépendant qui n'écrit que ses propres
 * champs. C'est délibéré : un formulaire unique de deux cents champs se
 * réenvoie en entier à chaque virgule, et une erreur de validation dans les
 * avis ferait perdre une refonte de la page d'accueil saisie juste au-dessus.
 *
 * Les sections portent le nom qu'elles ont sur le site, pas celui qu'elles ont
 * dans le fichier : quelqu'un qui veut changer la grande photo du haut cherche
 * « Accueil », pas `hero.image`.
 */

type Site = SiteConfig;

function section(
  slug: string,
  id: string,
  titre: string,
  intro: string,
  corps: string,
): string {
  return `<section class="bloc" id="${escape(id)}">
  <div class="bloc__tete">
    <h2>${escape(titre)}</h2>
    <p class="aide">${escape(intro)}</p>
  </div>
  <form method="post" action="/clients/${escape(slug)}/section/${escape(id)}"
        data-section="${escape(id)}">
    ${corps}
    <div class="actions">
      <button type="submit">Enregistrer cette section</button>
    </div>
  </form>
</section>`;
}

/* ------------------------------------------------------------------ accueil */

export function sectionAccueil(slug: string, site: Site, defaut: Language): string {
  return section(
    slug,
    "accueil",
    "Accueil",
    "La grande photo du haut et le texte posé dessus. C'est ce qu'on voit en premier, souvent la seule chose qu'on lit.",
    `${emplacementPhoto(slug, "hero.image", "Photo d'accueil", site.hero.image)}
${texteTraduit("hero.headline", "Titre", site.hero.headline, {
  defaut,
  aide: "Une phrase courte. Sur téléphone, au-delà de huit mots elle occupe tout l'écran.",
})}
${texteTraduit("hero.subline", "Sous-titre", site.hero.subline, {
  defaut,
  lignes: 2,
  aide: "Facultatif.",
})}`,
  );
}

/* ------------------------------------------------------- présentation */

export function sectionPresentation(slug: string, site: Site, defaut: Language): string {
  const b = site.business;
  return section(
    slug,
    "presentation",
    "Le commerce",
    "Le nom, la description et les coordonnées. Ces informations alimentent aussi la fiche Google et les données structurées.",
    `${texte("business.name", "Nom du commerce", b.name)}
${texteTraduit("business.tagline", "Slogan", b.tagline, {
  defaut,
  aide: "Quelques mots sous le nom. Apparaît aussi dans l'onglet du navigateur.",
})}
${texteTraduit("business.description", "Description", b.description, {
  defaut,
  lignes: 5,
  aide: "Deux à quatre phrases. Reprise par les moteurs de recherche.",
})}

<fieldset>
  <legend>Adresse</legend>
  <div class="row">
    ${texte("business.address.street", "Rue et numéro", b.address.street)}
    ${texte("business.address.postalCode", "Code postal", b.address.postalCode)}
    ${texte("business.address.city", "Ville", b.address.city)}
  </div>
</fieldset>

<fieldset>
  <legend>Contact</legend>
  <div class="row">
    ${texte("business.phone", "Téléphone", b.phone)}
    ${texte("business.email", "E-mail", b.email, { type: "email" })}
  </div>
</fieldset>

<fieldset>
  <legend>Réseaux sociaux</legend>
  <div class="row">
    ${texte("business.social.instagram", "Instagram", b.social.instagram, {
      type: "url",
      aide: "Adresse complète, https:// compris. Vide = pas de lien.",
    })}
    ${texte("business.social.facebook", "Facebook", b.social.facebook, { type: "url" })}
    ${texte("business.social.tiktok", "TikTok", b.social.tiktok, { type: "url" })}
  </div>
</fieldset>`,
  );
}

/* ----------------------------------------------------------------- horaires */

export function sectionHoraires(
  slug: string,
  site: Site,
  formatSlots: (creneaux: unknown) => string,
): string {
  const jours: Array<[string, string]> = [
    ["monday", "Lundi"],
    ["tuesday", "Mardi"],
    ["wednesday", "Mercredi"],
    ["thursday", "Jeudi"],
    ["friday", "Vendredi"],
    ["saturday", "Samedi"],
    ["sunday", "Dimanche"],
  ];

  const champs = jours
    .map(
      ([cle, nom]) => `<label>${nom}
      <input type="text" name="hours.${cle}"
             value="${escape(formatSlots(site.hours[cle as keyof typeof site.hours]))}"
             placeholder="fermé">
    </label>`,
    )
    .join("");

  return section(
    slug,
    "horaires",
    "Horaires",
    "Les heures d'ouverture affichées sur le site. Elles servent aussi à calculer les créneaux de réservation : une journée fermée ici ne propose aucun rendez-vous.",
    `<div class="row">${champs}</div>
<p class="aide">
  Un créneau par jour : <code>09:00-18:00</code>. Plusieurs créneaux se séparent
  par une virgule : <code>09:00-12:30, 13:30-18:00</code>. Laisser vide ferme la
  journée.
</p>`,
  );
}

/* ------------------------------------------------------------------ galerie */

export function sectionGalerie(slug: string, site: Site, defaut: Language): string {
  const elements = site.gallery
    .map(
      (photo, index) => `<li class="element" data-element>
  ${barreElement(index, `Photo ${index + 1}`)}
  <div class="element__corps">
    ${emplacementPhoto(slug, `gallery.${index}.src`, "Image", photo.src)}
    ${texteTraduit(`gallery.${index}.alt`, "Description de l'image", photo.alt, {
      defaut,
      aide: "Lue à voix haute par les lecteurs d'écran, et affichée si l'image ne charge pas.",
    })}
  </div>
</li>`,
    )
    .join("");

  return section(
    slug,
    "galerie",
    "Galerie",
    "Les photos du salon et des réalisations. Glissez une vignette pour changer l'ordre — c'est celui qu'aura le site.",
    `<ul class="liste" data-liste="gallery">${elements}</ul>
<div class="actions">
  <button type="button" class="secondary" data-ajouter="gallery">Ajouter une photo</button>
</div>

<template data-modele="gallery">
  <li class="element" data-element>
    ${barreElement(0, "Nouvelle photo")}
    <div class="element__corps">
      ${emplacementPhoto(slug, "gallery.0.src", "Image", undefined)}
      ${texteTraduit("gallery.0.alt", "Description de l'image", undefined, { defaut })}
    </div>
  </li>
</template>`,
  );
}

/* ------------------------------------------------------------------ déroulé */

export function sectionDeroule(slug: string, site: Site, defaut: Language): string {
  const elements = (site.steps ?? [])
    .map(
      (step, index) => `<li class="element" data-element>
  ${barreElement(index, step.title[defaut] ?? `Étape ${index + 1}`)}
  <div class="element__corps element__corps--deux">
    ${emplacementPhoto(slug, `steps.${index}.photo`, "Photo de l'étape", step.photo)}
    <div>
      ${texteTraduit(`steps.${index}.title`, "Titre de l'étape", step.title, {
        defaut,
        aide: "Court : c'est ce qui s'affiche en grand à côté de la photo.",
      })}
      ${texteTraduit(`steps.${index}.text`, "Description", step.text, {
        defaut,
        lignes: 3,
        aide: "Facultatif. Une ou deux phrases sur ce qui se passe à ce moment-là.",
      })}
    </div>
  </div>
</li>`,
    )
    .join("");

  return section(
    slug,
    "deroule",
    "Le déroulé d'une visite",
    "Les étapes que traverse un client, dans l'ordre. La photo reste à l'écran pendant qu'on les fait défiler. En dessous de deux étapes, la section disparaît du site.",
    `<ul class="liste" data-liste="steps">${elements}</ul>
<div class="actions">
  <button type="button" class="secondary" data-ajouter="steps">Ajouter une étape</button>
</div>

<template data-modele="steps">
  <li class="element" data-element>
    ${barreElement(0, "Nouvelle étape")}
    <div class="element__corps element__corps--deux">
      ${emplacementPhoto(slug, "steps.0.photo", "Photo de l'étape", undefined)}
      <div>
        ${texteTraduit("steps.0.title", "Titre de l'étape", undefined, { defaut })}
        ${texteTraduit("steps.0.text", "Description", undefined, { defaut, lignes: 3 })}
      </div>
    </div>
  </li>
</template>`,
  );
}

/* ------------------------------------------------------------------- équipe */

export function sectionEquipe(slug: string, site: Site, defaut: Language): string {
  const elements = site.team
    .map(
      (membre, index) => `<li class="element" data-element>
  ${barreElement(index, membre.name || `Personne ${index + 1}`)}
  <div class="element__corps element__corps--deux">
    ${emplacementPhoto(slug, `team.${index}.photo`, "Portrait", membre.photo)}
    <div>
      ${texte(`team.${index}.name`, "Prénom ou nom", membre.name)}
      ${texteTraduit(`team.${index}.role`, "Rôle", membre.role, {
        defaut,
        aide: "Par exemple : Maître barbier, Coloriste.",
      })}
    </div>
  </div>
</li>`,
    )
    .join("");

  return section(
    slug,
    "equipe",
    "Équipe",
    "Les personnes présentées sur le site. Sans photo, une initiale s'affiche à la place.",
    `<ul class="liste" data-liste="team">${elements}</ul>
<div class="actions">
  <button type="button" class="secondary" data-ajouter="team">Ajouter une personne</button>
</div>

<template data-modele="team">
  <li class="element" data-element>
    ${barreElement(0, "Nouvelle personne")}
    <div class="element__corps element__corps--deux">
      ${emplacementPhoto(slug, "team.0.photo", "Portrait", undefined)}
      <div>
        ${texte("team.0.name", "Prénom ou nom", "")}
        ${texteTraduit("team.0.role", "Rôle", undefined, { defaut })}
      </div>
    </div>
  </li>
</template>`,
  );
}

/* --------------------------------------------------------------------- avis */

export function sectionAvis(slug: string, site: Site, defaut: Language): string {
  const sources = [
    ["google", "Google"],
    ["facebook", "Facebook"],
    ["direct", "Reçu directement"],
  ] as const;

  const choixSource = (nom: string, valeur: string) =>
    `<label>Provenance
      <select name="${escape(nom)}">
        ${sources
          .map(
            ([v, l]) =>
              `<option value="${v}"${v === valeur ? " selected" : ""}>${l}</option>`,
          )
          .join("")}
      </select>
    </label>`;

  const elements = site.reviews
    .map(
      (avis, index) => `<li class="element" data-element>
  ${barreElement(index, avis.author || `Avis ${index + 1}`)}
  <div class="element__corps">
    <div class="row">
      ${texte(`reviews.${index}.author`, "Auteur", avis.author)}
      ${texte(`reviews.${index}.rating`, "Note sur 5", String(avis.rating), {
        type: "number",
        attributs: 'min="1" max="5" step="1"',
      })}
      ${choixSource(`reviews.${index}.source`, avis.source)}
    </div>
    ${texteTraduit(`reviews.${index}.text`, "Avis", avis.text, { defaut, lignes: 3 })}
  </div>
</li>`,
    )
    .join("");

  return section(
    slug,
    "avis",
    "Avis",
    "Les témoignages affichés sur le site. Ne recopiez que des avis réellement reçus : un faux avis est une pratique commerciale trompeuse.",
    `<ul class="liste" data-liste="reviews">${elements}</ul>
<div class="actions">
  <button type="button" class="secondary" data-ajouter="reviews">Ajouter un avis</button>
</div>

<template data-modele="reviews">
  <li class="element" data-element>
    ${barreElement(0, "Nouvel avis")}
    <div class="element__corps">
      <div class="row">
        ${texte("reviews.0.author", "Auteur", "")}
        ${texte("reviews.0.rating", "Note sur 5", "5", {
          type: "number",
          attributs: 'min="1" max="5" step="1"',
        })}
        ${choixSource("reviews.0.source", "google")}
      </div>
      ${texteTraduit("reviews.0.text", "Avis", undefined, { defaut, lignes: 3 })}
    </div>
  </li>
</template>`,
  );
}

/* -------------------------------------------------------------- prestations */

export function sectionPrestations(slug: string, site: Site, defaut: Language): string {
  const elements = site.services
    .map(
      (service, index) => `<li class="element" data-element>
  ${barreElement(index, service.name[defaut] ?? service.id)}
  <div class="element__corps">
    ${texteTraduit(`services.${index}.name`, "Nom de la prestation", service.name, {
      defaut,
    })}
    <div class="row">
      ${texte(`services.${index}.durationMin`, "Durée (minutes)", String(service.durationMin), {
        type: "number",
        attributs: 'min="5" max="600" step="5"',
        aide: "Sert à calculer les créneaux de réservation.",
      })}
      ${texte(
        `services.${index}.price`,
        "Prix (€)",
        service.price === null ? "" : String(service.price),
        { type: "number", attributs: 'min="0" step="1"', aide: "Vide = sur devis." },
      )}
      <label>Affichage du prix
        <select name="services.${index}.priceFrom">
          <option value=""${service.priceFrom ? "" : " selected"}>Prix exact</option>
          <option value="1"${service.priceFrom ? " selected" : ""}>« à partir de »</option>
        </select>
      </label>
    </div>
    <input type="hidden" name="services.${index}.id" value="${escape(service.id)}">
  </div>
</li>`,
    )
    .join("");

  return section(
    slug,
    "prestations",
    "Prestations",
    "Ce que propose le commerce, avec les durées qui servent à calculer les créneaux de réservation.",
    `<ul class="liste" data-liste="services">${elements}</ul>
<p class="aide">
  L'identifiant technique de chaque prestation n'est pas modifiable : des
  rendez-vous déjà pris s'y réfèrent. Pour en ajouter une, passez par
  l'édition avancée.
</p>`,
  );
}


/* ------------------------------------------------------------------- carte */

/**
 * La carte, à plat.
 *
 * Une ligne par plat, avec le nom de son groupe — comme la catégorie d'une
 * prestation. Le fichier, lui, garde des groupes ordonnés : c'est
 * `appliquerSection("carte")` qui les reconstitue, dans l'ordre de première
 * apparition. Le gain est net à la saisie : on recopie une carte de haut en
 * bas, sans ouvrir un groupe avant de pouvoir écrire un plat.
 */
export function sectionCarte(slug: string, site: Site, defaut: Language): string {
  const TAGS: Array<[string, string]> = [
    ["vegetarien", "Végétarien"],
    ["vegan", "Vegan"],
    ["sans-gluten", "Sans gluten"],
    ["epice", "Épicé"],
    ["maison", "Fait maison"],
  ];

  // La carte est aplatie pour l'édition, groupe par groupe et dans l'ordre.
  const plats = site.menu.flatMap((groupe) =>
    groupe.items.map((plat) => ({ groupe, plat })),
  );

  const ligne = (
    index: number,
    titreGroupe: Partial<Record<Language, string>> | undefined,
    plat: Site["menu"][number]["items"][number] | undefined,
  ): string => `<li class="element" data-element>
  ${barreElement(index, plat?.name[defaut] ?? "Nouveau plat")}
  <div class="element__corps">
    ${texteTraduit(`carte.${index}.group`, "Groupe", titreGroupe, {
      defaut,
      aide: "Entrées, Plats, Desserts, Boissons… Laissé vide, le plat rejoint le groupe précédent.",
    })}
    ${texteTraduit(`carte.${index}.name`, "Plat", plat?.name, { defaut })}
    ${texteTraduit(`carte.${index}.description`, "Description", plat?.description, {
      defaut,
      lignes: 2,
    })}
    ${texte(
      `carte.${index}.price`,
      "Prix (€)",
      plat?.price === null || plat?.price === undefined ? "" : String(plat.price),
      { aide: "Vide = « sur devis », pour ce qui change selon l'arrivage." },
    )}
    <div class="cases">
      ${TAGS.map(
        ([cle, libelle]) => `<label class="case">
        <input type="checkbox" name="carte.${index}.tags.${cle}"${
          plat?.tags.includes(cle as never) ? " checked" : ""
        }>
        <span>${libelle}</span>
      </label>`,
      ).join("")}
    </div>
  </div>
</li>`;

  const elements = plats.map(({ groupe, plat }, index) => ligne(index, groupe.title, plat)).join("");

  return section(
    slug,
    "carte",
    "La carte",
    "Ce que le client vient chercher avant les photos : les plats, les boissons et leurs prix. Un groupe vide reprend celui de la ligne du dessus.",
    `${texteTraduit("menuNote", "Mot au-dessus de la carte", site.menuNote, {
      defaut,
      aide: "« La carte change chaque semaine », « allergènes sur demande »…",
    })}
<ul class="liste" data-liste="carte">${elements}</ul>
<div class="actions">
  <button type="button" class="secondary" data-ajouter="carte">Ajouter un plat</button>
</div>

<template data-modele="carte">
  ${ligne(0, undefined, undefined)}
</template>`,
  );
}

/* ---------------------------------------------------------------- planning */

/**
 * Le planning des cours.
 *
 * Affiché, pas réservable : voir `Planning.astro`. Le formulaire ne demande
 * donc ni capacité obligatoire ni inscription — seulement de quoi répondre à
 * « qu'est-ce qu'il y a le mardi soir ? ».
 */
export function sectionPlanning(slug: string, site: Site, defaut: Language): string {
  const JOURS: Array<[string, string]> = [
    ["monday", "Lundi"],
    ["tuesday", "Mardi"],
    ["wednesday", "Mercredi"],
    ["thursday", "Jeudi"],
    ["friday", "Vendredi"],
    ["saturday", "Samedi"],
    ["sunday", "Dimanche"],
  ];

  const ligne = (index: number, cours: Site["courses"][number] | undefined): string =>
    `<li class="element" data-element>
  ${barreElement(index, cours?.name[defaut] ?? "Nouveau cours")}
  <div class="element__corps">
    ${texteTraduit(`courses.${index}.name`, "Nom du cours", cours?.name, { defaut })}
    <div class="row">
      <label>Jour
        <select name="courses.${index}.day">
          ${JOURS.map(
            ([cle, nom]) =>
              `<option value="${cle}"${cours?.day === cle ? " selected" : ""}>${nom}</option>`,
          ).join("")}
        </select>
      </label>
      ${texte(`courses.${index}.start`, "Début", cours?.start ?? "18:00", { type: "time" })}
      ${texte(`courses.${index}.end`, "Fin", cours?.end ?? "19:00", { type: "time" })}
    </div>
    <div class="row">
      ${texte(`courses.${index}.coach`, "Coach", cours?.coach, {
        aide: "Le prénom suffit : c'est lui qu'on suit.",
      })}
      ${texte(
        `courses.${index}.capacity`,
        "Places",
        cours?.capacity === undefined ? "" : String(cours.capacity),
        { type: "number", attributs: 'min="1" max="500" step="1"', aide: "Vide = non annoncé." },
      )}
    </div>
    ${texteTraduit(`courses.${index}.level`, "Niveau", cours?.level, {
      defaut,
      aide: "« Tous niveaux », « débutants »…",
    })}
    <input type="hidden" name="courses.${index}.id" value="${escape(cours?.id ?? "")}">
  </div>
</li>`;

  const elements = site.courses.map((cours, index) => ligne(index, cours)).join("");

  return section(
    slug,
    "planning",
    "Le planning",
    "Les cours de la semaine, avec leur horaire fixe. Affiché sur le site, sans inscription en ligne : la salle confirme les places.",
    `<ul class="liste" data-liste="courses">${elements}</ul>
<div class="actions">
  <button type="button" class="secondary" data-ajouter="courses">Ajouter un cours</button>
</div>

<template data-modele="courses">
  ${ligne(0, undefined)}
</template>`,
  );
}

/* ---------------------------------------------------------------------- SEO */

export function sectionReferencement(slug: string, site: Site, defaut: Language): string {
  return section(
    slug,
    "referencement",
    "Référencement",
    "Ce qu'affichent Google et les aperçus de partage. Laissés vides, le nom et la description du commerce sont utilisés.",
    `${texteTraduit("seo.title", "Titre dans les résultats", site.seo.title, {
      defaut,
      aide: "Une soixantaine de caractères. Au-delà, Google coupe.",
    })}
${texteTraduit("seo.description", "Description dans les résultats", site.seo.description, {
  defaut,
  lignes: 3,
  aide: "Environ cent cinquante caractères.",
})}`,
  );
}

/* ---------------------------------------------------------------- fleuriste */

/*
 * Ces quatre sections ne sont rendues que pour les métiers qui les affichent
 * (voir `metiers.ts`). Un salon de coiffure ne les voit pas : elles ne lui
 * serviraient à rien, et un éditeur qui propose vingt sections dont douze
 * inutiles n'est plus un éditeur, c'est un formulaire administratif.
 */

export function sectionOccasions(slug: string, site: Site, defaut: Language): string {
  const elements = (site.occasions ?? [])
    .map(
      (occasion, index) => `<li class="element" data-element>
  ${barreElement(index, occasion.title[defaut] ?? `Occasion ${index + 1}`)}
  <div class="element__corps">
    ${texteTraduit(`occasions.${index}.title`, "Titre", occasion.title, { defaut })}
    ${texteTraduit(`occasions.${index}.text`, "Texte", occasion.text, {
      defaut,
      aide: "Deux phrases. Ce que vous faites pour cette occasion, et ce que le client doit vous dire.",
      lignes: 3,
    })}
    ${emplacementPhoto(slug, `occasions.${index}.photo`, "Photo", occasion.photo)}
    ${texte(`occasions.${index}.price`, "Prix d'entrée (€)", occasion.price === null ? "" : String(occasion.price), {
      aide: "Toujours affiché « à partir de ». Laissé vide : rien ne s'affiche.",
    })}
    <input type="hidden" name="occasions.${index}.id" value="${escape(occasion.id)}">
  </div>
</li>`,
    )
    .join("");

  return section(
    slug,
    "occasions",
    "Occasions",
    "C'est par là que vos clients entrent : on ne cherche pas « bouquet rond », on cherche des fleurs pour un mariage ou pour un enterrement.",
    `<ul class="liste" data-liste="occasions">${elements}</ul>
<div class="actions">
  <button type="button" class="secondary" data-ajouter="occasions">Ajouter une occasion</button>
</div>

<template data-modele="occasions">
  <li class="element" data-element>
    ${barreElement(0, "Nouvelle occasion")}
    <div class="element__corps">
      ${texteTraduit("occasions.0.title", "Titre", undefined, { defaut })}
      ${texteTraduit("occasions.0.text", "Texte", undefined, { defaut, lignes: 3 })}
      ${emplacementPhoto(slug, "occasions.0.photo", "Photo", undefined)}
      ${texte("occasions.0.price", "Prix d'entrée (€)", "")}
      <input type="hidden" name="occasions.0.id" value="">
    </div>
  </li>
</template>`,
  );
}

export function sectionLivraison(slug: string, site: Site, defaut: Language): string {
  const livraison = site.delivery;

  return section(
    slug,
    "livraison",
    "Livraison",
    "La première question de tous vos clients. Videz la liste des communes pour retirer complètement la section.",
    `${texte("delivery.zones", "Communes desservies", (livraison?.zones ?? []).join(", "), {
      aide: "Séparées par des virgules. Telles que vous les diriez au téléphone.",
    })}
${texte("delivery.cutoff", "Heure limite pour le jour même", livraison?.cutoff ?? "", {
  aide: "Format 14:00. Laissée vide, aucune heure n'est annoncée.",
})}
${texte("delivery.fee", "Frais de livraison (€)", livraison?.fee === null || livraison?.fee === undefined ? "" : String(livraison.fee), {
  aide: "Vide ou 0 : la livraison est annoncée offerte.",
})}
${texte("delivery.freeFrom", "Offerte à partir de (€)", livraison?.freeFrom === undefined ? "" : String(livraison.freeFrom))}
${texteTraduit("delivery.note", "Précision", livraison?.note, {
  defaut,
  aide: "Par exemple : « au-delà de ces communes, appelez-nous ».",
  lignes: 2,
})}`,
  );
}

export function sectionDeuil(slug: string, site: Site, defaut: Language): string {
  const deuil = site.mourning;

  return section(
    slug,
    "deuil",
    "Fleurs de deuil",
    "Une section au ton distinct, sans prix ni formulaire : un client endeuillé veut savoir que vous vous en occupez, et un numéro. Videz le texte pour retirer la section.",
    `${texteTraduit("mourning.text", "Ce que vous proposez", deuil?.text, {
      defaut,
      aide: "Dites ce dont vous vous chargez — y compris la coordination avec les pompes funèbres, si vous le faites.",
      lignes: 3,
    })}
${texte("mourning.phone", "Numéro à appeler", deuil?.phone ?? "", {
  aide: "Laissé vide, c'est le numéro du commerce qui s'affiche.",
})}
${texte("mourning.venues", "Funérariums et lieux desservis", (deuil?.venues ?? []).join(", "), {
  aide: "Séparés par des virgules. C'est ce que la famille cherche à vérifier.",
})}
${emplacementPhoto(slug, "mourning.photo", "Photo", deuil?.photo)}`,
  );
}

export function sectionAbonnements(slug: string, site: Site, defaut: Language): string {
  const elements = (site.subscriptions ?? [])
    .map(
      (formule, index) => `<li class="element" data-element>
  ${barreElement(index, formule.name[defaut] ?? `Formule ${index + 1}`)}
  <div class="element__corps">
    ${texteTraduit(`subscriptions.${index}.name`, "Nom de la formule", formule.name, { defaut })}
    ${texteTraduit(`subscriptions.${index}.rhythm`, "Rythme", formule.rhythm, {
      defaut,
      aide: "« Un bouquet par semaine », « tous les quinze jours »…",
    })}
    ${texte(`subscriptions.${index}.price`, "Prix par livraison (€)", formule.price === null ? "" : String(formule.price))}
    ${texteTraduit(`subscriptions.${index}.text`, "Précision", formule.text, { defaut, lignes: 3 })}
    <input type="hidden" name="subscriptions.${index}.id" value="${escape(formule.id)}">
  </div>
</li>`,
    )
    .join("");

  return section(
    slug,
    "abonnements",
    "Abonnements",
    "Le seul revenu qui revient tous les mois — restaurants, cabinets, halls d'accueil. Presque aucun fleuriste n'en parle sur son site.",
    `<ul class="liste" data-liste="subscriptions">${elements}</ul>
<div class="actions">
  <button type="button" class="secondary" data-ajouter="subscriptions">Ajouter une formule</button>
</div>

<template data-modele="subscriptions">
  <li class="element" data-element>
    ${barreElement(0, "Nouvelle formule")}
    <div class="element__corps">
      ${texteTraduit("subscriptions.0.name", "Nom de la formule", undefined, { defaut })}
      ${texteTraduit("subscriptions.0.rhythm", "Rythme", undefined, { defaut })}
      ${texte("subscriptions.0.price", "Prix par livraison (€)", "")}
      ${texteTraduit("subscriptions.0.text", "Précision", undefined, { defaut, lignes: 3 })}
      <input type="hidden" name="subscriptions.0.id" value="">
    </div>
  </li>
</template>`,
  );
}
