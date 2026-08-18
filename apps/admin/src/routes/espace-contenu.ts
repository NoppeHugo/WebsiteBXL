import { createReadStream } from "node:fs";
import type { FastifyInstance } from "fastify";
import { WEEKDAYS } from "@bxl/schema";
import { client, pull } from "../repo.ts";
import { config } from "../config.ts";
import { utilisateur, siteDuCommercant } from "../acces.ts";
import { enregistrerEtPublier } from "../publication.ts";
import { formatSlots } from "../hours.ts";
import { listMedia, mediaPath, saveMedia, deleteMedia, MAX_UPLOAD_BYTES } from "../media.ts";
import { layoutClient, message } from "../views-client.ts";
import { escape } from "../views.ts";
import type { Champs } from "../contenu.ts";

/**
 * Horaires, tarifs, photos et texte.
 *
 * Quatre pages, un formulaire chacune, un bouton chacune. Rien n'y est
 * réutilisé de la console de l'exploitant : ses champs à lui portent trois
 * onglets de langue, des identifiants techniques et un éditeur JSON. Ce sont
 * les bons outils pour quelqu'un qui gère trente sites, et les mauvais pour
 * quelqu'un qui gère le sien trois fois par an.
 */

const NOMS_JOURS: Record<string, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
};

/* -------------------------------------------------------------------------- */
/* Horaires                                                                   */
/* -------------------------------------------------------------------------- */

function pageHoraires(slug: string, flash?: { ton: "ok" | "ko"; texte: string }): string {
  const { site } = client(slug);

  const jours = WEEKDAYS.map((jour) => {
    const creneaux = site.hours[jour];
    const ouvert = creneaux.length > 0;
    const premier = creneaux[0];
    return `<div class="jour" data-jour data-ferme="${ouvert ? "non" : "oui"}">
  <div class="jour__tete">
    <span class="jour__nom">${NOMS_JOURS[jour]}</span>
    <label class="bascule">
      <input type="checkbox" data-ouvert${ouvert ? " checked" : ""}
             aria-label="${NOMS_JOURS[jour]} ouvert">
      <span class="bascule__piste"></span>
      <span class="bascule__mot" data-mot>${ouvert ? "Ouvert" : "Fermé"}</span>
    </label>
  </div>
  <div class="jour__heures">
    <input type="time" data-de value="${escape(premier?.open ?? "09:00")}"
           aria-label="${NOMS_JOURS[jour]} — ouverture">
    <span>à</span>
    <input type="time" data-a value="${escape(premier?.close ?? "18:00")}"
           aria-label="${NOMS_JOURS[jour]} — fermeture">
  </div>
  <input type="hidden" name="hours.${jour}" value="${escape(formatSlots(creneaux))}">
</div>`;
  }).join("");

  const pauses = WEEKDAYS.some((jour) => site.hours[jour].length > 1);

  return layoutClient(
    "Mes horaires",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mes horaires</h1>
<p class="chapeau">
  Vos heures d'ouverture habituelles. Pour une fermeture ponctuelle, passez
  plutôt par <a href="/espace/fermetures">Je ferme</a>.
</p>

${
  pauses
    ? `<div class="etat" data-ton="alerte">
  <b>Vos horaires comportent une coupure de midi</b>
  <span>Cette page ne montre que la première plage de chaque journée.
    Enregistrer ici remplacerait vos horaires par une seule plage par jour —
    demandez plutôt la modification à votre prestataire.</span>
</div>`
    : ""
}

<form method="post" action="/espace/horaires">
  ${jours}
  <div class="actions">
    <button type="submit" data-lent="Mise à jour du site…">Enregistrer et mettre en ligne</button>
  </div>
</form>`,
    { nomCommerce: site.business.name, retour: "/espace", script: true },
  );
}

/* -------------------------------------------------------------------------- */
/* Tarifs                                                                     */
/* -------------------------------------------------------------------------- */

function pageTarifs(slug: string, flash?: { ton: "ok" | "ko"; texte: string }): string {
  const { site } = client(slug);
  const langue = site.languages.default;

  const lignes = site.services
    .map(
      (service, i) => `<div class="ligne" data-ligne>
  <label>Prestation
    <input type="text" name="services.${i}.name.${escape(langue)}"
           value="${escape(service.name[langue] ?? Object.values(service.name)[0] ?? "")}"
           required maxlength="80">
  </label>
  <div class="ligne__paire">
    <label>Durée
      <select name="services.${i}.durationMin">
        ${[15, 20, 30, 45, 60, 75, 90, 120, 150, 180]
          .map(
            (m) =>
              `<option value="${m}"${m === service.durationMin ? " selected" : ""}>${
                m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`
              }</option>`,
          )
          .join("")}
      </select>
    </label>
    <label>Prix (€)
      <input type="text" inputmode="decimal" name="services.${i}.price"
             value="${service.price === null ? "" : escape(String(service.price))}"
             placeholder="sur devis">
    </label>
  </div>
  <input type="hidden" name="services.${i}.id" value="${escape(service.id)}">
  <button type="button" class="ligne__retirer" data-retirer>Retirer cette prestation</button>
</div>`,
    )
    .join("");

  return layoutClient(
    "Mes tarifs",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mes tarifs</h1>
<p class="chapeau">
  Ce que vous proposez, avec les durées. La durée sert à calculer les créneaux
  de rendez-vous : une coupe de 30 minutes occupe 30 minutes dans l'agenda.
</p>

<form method="post" action="/espace/tarifs">
  <div data-liste-tarifs>${lignes}</div>
  <div class="actions">
    <button type="button" class="second" data-ajouter>+ Ajouter une prestation</button>
    <button type="submit" data-lent="Mise à jour du site…">Enregistrer et mettre en ligne</button>
  </div>
  <p class="aide">
    Prix laissé vide : le site affiche « sur devis ».
  </p>
</form>

<template data-modele>
  <div class="ligne" data-ligne>
    <label>Prestation
      <input type="text" name="services.X.name.${escape(langue)}" required maxlength="80">
    </label>
    <div class="ligne__paire">
      <label>Durée
        <select name="services.X.durationMin">
          <option value="15">15 min</option>
          <option value="20">20 min</option>
          <option value="30" selected>30 min</option>
          <option value="45">45 min</option>
          <option value="60">1 h</option>
          <option value="75">1 h 15</option>
          <option value="90">1 h 30</option>
          <option value="120">2 h</option>
          <option value="150">2 h 30</option>
          <option value="180">3 h</option>
        </select>
      </label>
      <label>Prix (€)
        <input type="text" inputmode="decimal" name="services.X.price" placeholder="sur devis">
      </label>
    </div>
    <input type="hidden" name="services.X.id" value="">
    <button type="button" class="ligne__retirer" data-retirer>Retirer cette prestation</button>
  </div>
</template>`,
    { nomCommerce: site.business.name, retour: "/espace", script: true },
  );
}

/* -------------------------------------------------------------------------- */
/* Photos                                                                     */
/* -------------------------------------------------------------------------- */

function pagePhotos(slug: string, flash?: { ton: "ok" | "ko"; texte: string }): string {
  const { site } = client(slug);
  const langue = site.languages.default;
  const fichiers = listMedia(config.REPO_PATH, slug);
  const dansLaGalerie = new Set(site.gallery.map((p) => p.src));

  const vignette = (nom: string, dedans: boolean) => `<div class="photo">
  <img src="/espace/photos/${encodeURIComponent(nom)}" alt="" loading="lazy">
  <div class="photo__pied">
    ${
      site.hero.image === nom
        ? `<span class="photo__marque">Photo principale</span>`
        : `<form method="post" action="/espace/photos/couverture">
             <input type="hidden" name="nom" value="${escape(nom)}">
             <button type="submit" class="second" data-lent="Mise à jour du site…">En couverture</button>
           </form>`
    }
    <form method="post" action="/espace/photos/retirer"
          data-confirmer="Retirer cette photo du site ?">
      <input type="hidden" name="nom" value="${escape(nom)}">
      <button type="submit" class="danger" data-lent="Mise à jour du site…">
        ${dedans ? "Retirer du site" : "Supprimer"}
      </button>
    </form>
  </div>
</div>`;

  const affichees = site.gallery.map((photo) => vignette(photo.src, true)).join("");

  const disponibles = fichiers
    .filter((f) => !dansLaGalerie.has(f.name) && f.name !== site.hero.image)
    .map((f) => `<div class="photo">
  <img src="/espace/photos/${encodeURIComponent(f.name)}" alt="" loading="lazy">
  <div class="photo__pied">
    <form method="post" action="/espace/photos/ajouter">
      <input type="hidden" name="nom" value="${escape(f.name)}">
      <button type="submit" data-lent="Mise à jour du site…">Mettre sur le site</button>
    </form>
  </div>
</div>`)
    .join("");

  return layoutClient(
    "Mes photos",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mes photos</h1>
<p class="chapeau">
  Les images visibles sur votre site. Prenez-les au téléphone, en lumière du
  jour : elles sont réduites et optimisées automatiquement.
</p>

<form method="post" action="/espace/photos/envoyer" enctype="multipart/form-data">
  <label class="depot" data-depot>
    <input type="file" name="photo" accept="image/*" data-fichier>
    <b>Ajouter une photo</b>
    <span>Appuyez ici, ou faites glisser une image</span>
  </label>
</form>

<h2>Sur le site</h2>
${
  affichees
    ? `<div class="photos">${affichees}</div>`
    : `<p class="vide">Aucune photo sur le site pour l'instant.</p>`
}

${
  disponibles
    ? `<h2>Disponibles</h2>
<p class="aide">Envoyées mais pas encore affichées.</p>
<div class="photos">${disponibles}</div>`
    : ""
}`,
    { nomCommerce: site.business.name, retour: "/espace", script: true },
  );
}

/** Les champs qui décrivent la galerie entière, pour l'enregistrer d'un bloc. */
function champsGalerie(
  photos: Array<{ src: string; alt: Record<string, string> }>,
): Champs {
  const champs: Champs = {};
  photos.forEach((photo, i) => {
    champs[`gallery.${i}.src`] = photo.src;
    for (const [langue, texte] of Object.entries(photo.alt)) {
      champs[`gallery.${i}.alt.${langue}`] = texte;
    }
  });
  return champs;
}

/* -------------------------------------------------------------------------- */
/* Texte                                                                      */
/* -------------------------------------------------------------------------- */

function pagePresentation(slug: string, flash?: { ton: "ok" | "ko"; texte: string }): string {
  const { site } = client(slug);
  const langue = site.languages.default;
  const autres = site.languages.available.filter((l) => l !== langue);

  /*
   * Toutes les langues du site sont renvoyées, y compris celles qu'on
   * n'affiche pas : la couche d'application remplace l'objet traduit en entier,
   * et n'envoyer que le français effacerait le néerlandais sans le dire.
   */
  const conserver = (cle: string, valeur: Record<string, string> | undefined) =>
    autres
      .map((l) =>
        valeur?.[l]
          ? `<input type="hidden" name="${cle}.${escape(l)}" value="${escape(valeur[l]!)}">`
          : "",
      )
      .join("");

  return layoutClient(
    "Mon texte",
    `${flash ? message(flash.ton, flash.texte) : ""}
<h1>Mon texte</h1>
<p class="chapeau">Ce qui est écrit sur votre salon, en page d'accueil.</p>

<form method="post" action="/espace/presentation">
  <label>Nom du salon
    <input type="text" name="business.name" value="${escape(site.business.name)}" required>
  </label>

  <label>Phrase d'accroche <span class="aide">— une ligne, sous le titre</span>
    <input type="text" name="business.tagline.${escape(langue)}" maxlength="120"
           value="${escape(site.business.tagline?.[langue] ?? "")}"
           placeholder="Coiffure et barbe à Saint-Gilles">
  </label>
  ${conserver("business.tagline", site.business.tagline)}

  <label>Présentation <span class="aide">— deux ou trois phrases</span>
    <textarea name="business.description.${escape(langue)}" required maxlength="900"
      >${escape(site.business.description[langue] ?? "")}</textarea>
  </label>
  ${conserver("business.description", site.business.description)}

  <label>Téléphone
    <input type="tel" name="business.phone" value="${escape(site.business.phone)}" required>
  </label>
  <label>E-mail
    <input type="email" name="business.email" value="${escape(site.business.email ?? "")}">
  </label>

  <h2>Où vous trouver</h2>
  <label>Rue et numéro
    <input type="text" name="business.address.street"
           value="${escape(site.business.address.street)}" required>
  </label>
  <label>Code postal
    <input type="text" name="business.address.postalCode"
           value="${escape(site.business.address.postalCode)}" required>
  </label>
  <label>Commune
    <input type="text" name="business.address.city"
           value="${escape(site.business.address.city)}" required>
  </label>

  <h2>Réseaux sociaux</h2>
  ${(["instagram", "facebook", "tiktok"] as const)
    .map(
      (reseau) => `<label>${reseau[0]!.toUpperCase()}${reseau.slice(1)}
    <input type="url" name="business.social.${reseau}"
           value="${escape(site.business.social[reseau] ?? "")}"
           placeholder="https://...">
  </label>`,
    )
    .join("")}

  <div class="actions">
    <button type="submit" data-lent="Mise à jour du site…">Enregistrer et mettre en ligne</button>
  </div>
  ${
    autres.length > 0
      ? `<p class="aide">
    Votre site existe aussi en ${autres.map((l) => (l === "nl" ? "néerlandais" : "anglais")).join(" et en ")}.
    Ces traductions sont conservées telles quelles — demandez leur mise à jour à
    votre prestataire.
  </p>`
      : ""
  }
</form>`,
    { nomCommerce: site.business.name, retour: "/espace", script: true },
  );
}

/* -------------------------------------------------------------------------- */

export function espaceContenuRoutes(app: FastifyInstance): void {
  /* --- horaires --- */

  app.get("/espace/horaires", async (request, reply) => {
    await pull();
    return reply
      .type("text/html")
      .send(pageHoraires(siteDuCommercant(utilisateur(request))));
  });

  app.post<{ Body: Record<string, string> }>(
    "/espace/horaires",
    async (request, reply) => {
      const u = utilisateur(request);
      const slug = siteDuCommercant(u);
      const resultat = await enregistrerEtPublier(
        slug,
        u.id,
        "horaires",
        (request.body ?? {}) as Champs,
      );
      return reply.type("text/html").send(
        pageHoraires(slug, {
          ton: resultat.ok ? "ok" : "ko",
          texte: resultat.ok ? "Vos horaires sont en ligne." : resultat.message,
        }),
      );
    },
  );

  /* --- tarifs --- */

  app.get("/espace/tarifs", async (request, reply) => {
    await pull();
    return reply.type("text/html").send(pageTarifs(siteDuCommercant(utilisateur(request))));
  });

  app.post<{ Body: Record<string, string> }>("/espace/tarifs", async (request, reply) => {
    const u = utilisateur(request);
    const slug = siteDuCommercant(u);
    const resultat = await enregistrerEtPublier(
      slug,
      u.id,
      "prestations",
      (request.body ?? {}) as Champs,
    );
    return reply.type("text/html").send(
      pageTarifs(slug, {
        ton: resultat.ok ? "ok" : "ko",
        texte: resultat.ok ? "Vos tarifs sont en ligne." : resultat.message,
      }),
    );
  });

  /* --- présentation --- */

  app.get("/espace/presentation", async (request, reply) => {
    await pull();
    return reply
      .type("text/html")
      .send(pagePresentation(siteDuCommercant(utilisateur(request))));
  });

  app.post<{ Body: Record<string, string> }>(
    "/espace/presentation",
    async (request, reply) => {
      const u = utilisateur(request);
      const slug = siteDuCommercant(u);
      const resultat = await enregistrerEtPublier(
        slug,
        u.id,
        "presentation",
        (request.body ?? {}) as Champs,
      );
      return reply.type("text/html").send(
        pagePresentation(slug, {
          ton: resultat.ok ? "ok" : "ko",
          texte: resultat.ok ? "C'est en ligne." : resultat.message,
        }),
      );
    },
  );

  /* --- photos --- */

  app.get("/espace/photos", async (request, reply) => {
    await pull();
    return reply.type("text/html").send(pagePhotos(siteDuCommercant(utilisateur(request))));
  });

  app.get<{ Params: { nom: string } }>(
    "/espace/photos/:nom",
    async (request, reply) => {
      const slug = siteDuCommercant(utilisateur(request));
      const chemin = mediaPath(config.REPO_PATH, slug, request.params.nom);
      if (!chemin) return reply.code(404).send("introuvable");
      return reply.type("image/jpeg").send(createReadStream(chemin));
    },
  );

  app.post("/espace/photos/envoyer", async (request, reply) => {
    const slug = siteDuCommercant(utilisateur(request));
    const part = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!part) {
      return reply
        .code(400)
        .type("text/html")
        .send(pagePhotos(slug, { ton: "ko", texte: "Aucune photo reçue." }));
    }

    const enregistre = await saveMedia(
      config.REPO_PATH,
      slug,
      part.filename,
      await part.toBuffer(),
    );

    /*
     * La photo entre dans la bibliothèque, pas sur le site.
     *
     * Un envoi qui publierait aussitôt ne laisserait aucun moment pour se
     * raviser, et la photo mal cadrée serait en ligne avant qu'on l'ait
     * regardée. Deux gestes, l'un après l'autre : envoyer, puis mettre sur le
     * site.
     */
    return reply.type("text/html").send(
      pagePhotos(slug, {
        ton: enregistre.ok ? "ok" : "ko",
        texte: enregistre.ok
          ? "Photo envoyée. Appuyez sur « Mettre sur le site » pour l'afficher."
          : `Photo refusée : ${enregistre.error}`,
      }),
    );
  });

  app.post<{ Body: { nom?: string } }>("/espace/photos/ajouter", async (request, reply) => {
    const u = utilisateur(request);
    const slug = siteDuCommercant(u);
    const { site } = client(slug);
    const nom = (request.body?.nom ?? "").trim();

    // Le nom vient d'un champ caché : on ne le croit pas sur parole, on vérifie
    // que le fichier existe bien dans la bibliothèque de CE commerce.
    if (!listMedia(config.REPO_PATH, slug).some((f) => f.name === nom)) {
      return reply
        .code(400)
        .type("text/html")
        .send(pagePhotos(slug, { ton: "ko", texte: "Photo inconnue." }));
    }

    const photos = [
      ...site.gallery.map((p) => ({ src: p.src, alt: p.alt as Record<string, string> })),
      {
        src: nom,
        // Le texte de remplacement sert aux lecteurs d'écran et à Google. À
        // défaut de description, le nom du commerce vaut mieux que rien.
        alt: { [site.languages.default]: site.business.name } as Record<string, string>,
      },
    ];

    const resultat = await enregistrerEtPublier(slug, u.id, "galerie", champsGalerie(photos));
    return reply.type("text/html").send(
      pagePhotos(slug, {
        ton: resultat.ok ? "ok" : "ko",
        texte: resultat.ok ? "La photo est sur le site." : resultat.message,
      }),
    );
  });

  app.post<{ Body: { nom?: string } }>("/espace/photos/retirer", async (request, reply) => {
    const u = utilisateur(request);
    const slug = siteDuCommercant(u);
    const { site } = client(slug);
    const nom = (request.body?.nom ?? "").trim();

    if (nom === site.hero.image) {
      return reply.code(400).type("text/html").send(
        pagePhotos(slug, {
          ton: "ko",
          texte:
            "C'est la photo principale du site : choisissez-en une autre en couverture avant de retirer celle-ci.",
        }),
      );
    }

    const restantes = site.gallery
      .filter((p) => p.src !== nom)
      .map((p) => ({ src: p.src, alt: p.alt as Record<string, string> }));

    const etaitAffichee = restantes.length !== site.gallery.length;
    if (etaitAffichee) {
      const resultat = await enregistrerEtPublier(
        slug,
        u.id,
        "galerie",
        champsGalerie(restantes),
      );
      if (!resultat.ok) {
        return reply
          .type("text/html")
          .send(pagePhotos(slug, { ton: "ko", texte: resultat.message }));
      }
    }

    // Le fichier n'est effacé qu'une fois qu'il ne sert plus nulle part.
    deleteMedia(config.REPO_PATH, slug, nom);

    return reply
      .type("text/html")
      .send(pagePhotos(slug, { ton: "ok", texte: "Photo retirée." }));
  });

  app.post<{ Body: { nom?: string } }>("/espace/photos/couverture", async (request, reply) => {
    const u = utilisateur(request);
    const slug = siteDuCommercant(u);
    const { site } = client(slug);
    const nom = (request.body?.nom ?? "").trim();

    if (!listMedia(config.REPO_PATH, slug).some((f) => f.name === nom)) {
      return reply
        .code(400)
        .type("text/html")
        .send(pagePhotos(slug, { ton: "ko", texte: "Photo inconnue." }));
    }

    const champs: Champs = { "hero.image": nom };
    // Le titre est obligatoire : le renvoyer inchangé évite que la section
    // « accueil » le vide en passant.
    for (const [l, texte] of Object.entries(site.hero.headline)) {
      champs[`hero.headline.${l}`] = texte;
    }
    for (const [l, texte] of Object.entries(site.hero.subline ?? {})) {
      champs[`hero.subline.${l}`] = texte;
    }
    const resultat = await enregistrerEtPublier(slug, u.id, "accueil", champs);
    return reply.type("text/html").send(
      pagePhotos(slug, {
        ton: resultat.ok ? "ok" : "ko",
        texte: resultat.ok ? "Nouvelle photo principale en ligne." : resultat.message,
      }),
    );
  });

}
