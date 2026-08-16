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
