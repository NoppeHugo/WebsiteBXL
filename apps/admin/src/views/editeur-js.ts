/**
 * Script de l'éditeur de contenu, servi tel quel par `/assets/editeur.js`.
 *
 * Écrit sans dépendance et sans étape de construction : la console est rendue
 * en HTML par le serveur, lui ajouter un empaqueteur pour trois cents lignes
 * coûterait plus cher que ces trois cents lignes.
 *
 * Tout ce qu'il fait reste facultatif. Sans JavaScript, les formulaires
 * s'envoient quand même, les champs fichier ouvrent le sélecteur habituel, et
 * seuls le glisser-déposer et l'ajout d'éléments manquent.
 */
export const EDITEUR_JS = String.raw`
(() => {
  "use strict";

  /* ------------------------------------------------------------- utilitaires */

  const $ = (racine, sel) => racine.querySelector(sel);
  const $$ = (racine, sel) => Array.from(racine.querySelectorAll(sel));

  /**
   * Renumérote un élément de liste.
   *
   * Les noms de champs portent leur position — « gallery.2.alt.fr ». Après un
   * déplacement, une suppression ou un ajout, ces positions ne correspondent
   * plus à l'ordre affiché : sans cette remise à plat, le serveur enregistrerait
   * l'ancien ordre, ou deux éléments à la même place.
   */
  function renumeroter(element, index) {
    for (const champ of $$(element, "[name]")) {
      champ.name = champ.name.replace(/^([a-z]+)\.\d+\./i, "$1." + index + ".");
    }

    const ordre = $(element, "[data-ordre]");
    if (ordre) ordre.value = String(index);

    /*
     * Les onglets de langue sont des boutons radio : deux éléments qui
     * partageraient le même « name » verraient leurs onglets se commander l'un
     * l'autre — cliquer « English » sur la deuxième photo replierait la
     * première. Les identifiants sont donc dérivés du nom du champ, qui vient
     * d'être renuméroté.
     */
    for (const onglets of $$(element, ".onglets")) {
      const premier = $(onglets, "input[type=text], textarea");
      if (!premier) continue;
      const base = premier.name.replace(/\.[a-z]{2}$/, "").replace(/[^a-z0-9]/gi, "-");

      const radios = $$(onglets, ".onglet__radio");
      const labels = $$(onglets, ".onglet__nom");
      radios.forEach((radio, i) => {
        const label = labels[i];
        if (!label) return;
        const id = base + "-" + i;
        radio.name = "onglet-" + base;
        radio.id = id;
        label.setAttribute("for", id);
      });
    }
  }

  function renumeroterListe(liste) {
    $$(liste, "[data-element]").forEach((element, index) => {
      renumeroter(element, index);
    });
  }

  /* ------------------------------------------------------------------ photos */

  /**
   * Envoi immédiat, dès le dépôt.
   *
   * L'image part seule, sans le reste du formulaire : le contenu saisi à côté
   * n'a pas à être renvoyé, et une image refusée — trop lourde, format inconnu —
   * n'emporte pas la description qu'on venait d'écrire.
   */
  async function televerser(bloc, fichier) {
    const etat = $(bloc, "[data-etat]");
    const apercu = $(bloc, "[data-apercu]");
    const valeur = $(bloc, "[data-valeur]");
    const invite = $(bloc, ".photo__invite");
    const retirer = $(bloc, "[data-retirer]");

    etat.hidden = false;
    etat.textContent = "Envoi…";
    bloc.dataset.occupe = "true";

    try {
      const corps = new FormData();
      corps.append("photo", fichier);
      const reponse = await fetch(
        "/clients/" + encodeURIComponent(bloc.dataset.slug) + "/media/upload",
        { method: "POST", body: corps },
      );
      const donnees = await reponse.json();

      if (!reponse.ok || !donnees.name) {
        throw new Error(donnees.error || "envoi refusé");
      }

      valeur.value = donnees.name;
      // L'horodatage force le navigateur à recharger l'image : remplacer un
      // fichier par un autre du même nom afficherait sinon l'ancienne.
      apercu.src =
        "/clients/" + encodeURIComponent(bloc.dataset.slug) + "/media/" +
        encodeURIComponent(donnees.name) + "?v=" + Date.now();
      apercu.hidden = false;
      if (invite) invite.hidden = true;
      if (retirer) retirer.hidden = false;
      etat.textContent = "Ajoutée — enregistrez la section pour l'appliquer";
    } catch (erreur) {
      etat.textContent = "Échec : " + erreur.message;
    } finally {
      bloc.dataset.occupe = "";
    }
  }

  function brancherPhoto(bloc) {
    if (bloc.dataset.branche) return;
    bloc.dataset.branche = "true";

    const zone = $(bloc, "[data-zone]");
    const entree = $(bloc, "[data-fichier]");
    const retirer = $(bloc, "[data-retirer]");

    entree.addEventListener("change", () => {
      if (entree.files && entree.files[0]) televerser(bloc, entree.files[0]);
    });

    // « dragover » doit être neutralisé, sinon le navigateur ouvre l'image
    // dans l'onglet au lieu de la confier à la page.
    for (const type of ["dragenter", "dragover"]) {
      zone.addEventListener(type, (evenement) => {
        evenement.preventDefault();
        zone.dataset.survol = "true";
      });
    }
    for (const type of ["dragleave", "drop"]) {
      zone.addEventListener(type, () => {
        zone.dataset.survol = "";
      });
    }
    zone.addEventListener("drop", (evenement) => {
      evenement.preventDefault();
      const fichier = evenement.dataTransfer && evenement.dataTransfer.files[0];
      if (fichier) televerser(bloc, fichier);
    });

    if (retirer) {
      retirer.addEventListener("click", () => {
        $(bloc, "[data-valeur]").value = "";
        const apercu = $(bloc, "[data-apercu]");
        apercu.hidden = true;
        apercu.removeAttribute("src");
        const invite = $(bloc, ".photo__invite");
        if (invite) invite.hidden = false;
        retirer.hidden = true;
        // Le fichier reste sur le serveur : il peut servir ailleurs, et rien
        // n'autorise à le détruire parce qu'un emplacement l'a lâché.
        $(bloc, "[data-etat]").hidden = false;
        $(bloc, "[data-etat]").textContent =
          "Retirée de cet emplacement. Le fichier reste dans les photos.";
      });
    }
  }

  /* ------------------------------------------------------------------ listes */

  function brancherElement(element, liste) {
    if (element.dataset.branche) return;
    element.dataset.branche = "true";

    const deplacer = (pas) => {
      const freres = $$(liste, "[data-element]");
      const index = freres.indexOf(element);
      const cible = index + pas;
      if (cible < 0 || cible >= freres.length) return;
      if (pas < 0) liste.insertBefore(element, freres[cible]);
      else liste.insertBefore(freres[cible], element);
      renumeroterListe(liste);
      element.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };

    $(element, "[data-monter]").addEventListener("click", () => deplacer(-1));
    $(element, "[data-descendre]").addEventListener("click", () => deplacer(1));
    $(element, "[data-supprimer]").addEventListener("click", () => {
      const titre = $(element, ".element__titre");
      const nom = titre ? titre.textContent.trim() : "cet élément";
      if (!confirm("Retirer " + nom + " ? La suppression prendra effet à l'enregistrement.")) {
        return;
      }
      element.remove();
      renumeroterListe(liste);
    });

    // La poignée n'est saisissable qu'à la souris : les deux flèches restent
    // le chemin praticable au clavier et au doigt.
    const poignee = $(element, "[data-poignee]");
    if (poignee) {
      poignee.addEventListener("mousedown", () => {
        element.draggable = true;
      });
      element.addEventListener("dragend", () => {
        element.draggable = false;
      });
    }

    for (const bloc of $$(element, "[data-photo]")) brancherPhoto(bloc);
  }

  function brancherListe(liste) {
    let saisi = null;

    liste.addEventListener("dragstart", (evenement) => {
      const element = evenement.target.closest("[data-element]");
      if (!element) return;
      saisi = element;
      element.dataset.saisi = "true";
      evenement.dataTransfer.effectAllowed = "move";
      // Firefox n'amorce pas le glissement sans données attachées.
      evenement.dataTransfer.setData("text/plain", "");
    });

    liste.addEventListener("dragover", (evenement) => {
      if (!saisi) return;
      evenement.preventDefault();
      const survole = evenement.target.closest("[data-element]");
      if (!survole || survole === saisi) return;

      // Comparer les milieux plutôt que les bords : l'élément ne bascule qu'une
      // fois le curseur passé au-delà de son centre, ce qui évite l'aller-retour
      // continu quand deux éléments se chevauchent.
      const cadre = survole.getBoundingClientRect();
      const avant = evenement.clientY < cadre.top + cadre.height / 2;
      liste.insertBefore(saisi, avant ? survole : survole.nextSibling);
    });

    liste.addEventListener("drop", (evenement) => evenement.preventDefault());

    liste.addEventListener("dragend", () => {
      if (!saisi) return;
      saisi.dataset.saisi = "";
      saisi.draggable = false;
      saisi = null;
      renumeroterListe(liste);
    });

    for (const element of $$(liste, "[data-element]")) brancherElement(element, liste);
  }

  /* ------------------------------------------------------------------ ajouts */

  for (const bouton of $$(document, "[data-ajouter]")) {
    bouton.addEventListener("click", () => {
      const nom = bouton.dataset.ajouter;
      const liste = $(document, '[data-liste="' + nom + '"]');
      const modele = $(document, '[data-modele="' + nom + '"]');
      if (!liste || !modele) return;

      const element = modele.content.firstElementChild.cloneNode(true);
      liste.append(element);
      brancherElement(element, liste);
      renumeroterListe(liste);
      element.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const premier = $(element, "input[type=text]");
      if (premier) premier.focus();
    });
  }

  /* --------------------------------------------------- confirmations */

  /*
   * Les confirmations passaient par « onsubmit » écrit dans le balisage. La
   * politique de sécurité de la console interdit les gestionnaires en ligne :
   * ils ne s'exécutaient donc pas, et une suppression de photo partait au
   * premier clic, sans un mot. La délégation ci-dessous les rétablit sans
   * rouvrir la porte au script en ligne.
   */
  document.addEventListener("submit", (evenement) => {
    const formulaire = evenement.target;
    const question = formulaire.dataset && formulaire.dataset.confirmer;
    if (question && !confirm(question)) evenement.preventDefault();
  });

  /* ------------------------------------------------------------- démarrage */

  for (const liste of $$(document, "[data-liste]")) brancherListe(liste);
  for (const bloc of $$(document, "[data-photo]")) brancherPhoto(bloc);

  /*
   * Une section quittée sans enregistrer perd ses modifications. Le rappel ne
   * s'arme qu'après une vraie saisie : le poser d'emblée déclencherait
   * l'avertissement du navigateur sur une page seulement consultée.
   */
  let modifie = false;
  for (const formulaire of $$(document, "[data-section]")) {
    formulaire.addEventListener("input", () => {
      modifie = true;
    });
    formulaire.addEventListener("submit", () => {
      modifie = false;
    });
  }
  addEventListener("beforeunload", (evenement) => {
    if (!modifie) return;
    evenement.preventDefault();
    evenement.returnValue = "";
  });
})();
`;
