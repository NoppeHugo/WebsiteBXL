/**
 * Script de l'espace commerçant, servi tel quel par `/assets/espace.js`.
 *
 * Sans dépendance et sans étape de construction, comme celui de l'éditeur.
 *
 * ─── Tout y est facultatif ────────────────────────────────────────────────
 *
 * Sans JavaScript, chaque page reste utilisable : les horaires se saisissent
 * dans leur champ texte, les tarifs existants se modifient, les photos
 * s'envoient par le sélecteur de fichiers habituel. Seuls l'interrupteur
 * ouvert/fermé, l'ajout d'une prestation, les raccourcis de dates et le
 * glisser-déposer disparaissent.
 *
 * Ce n'est pas de la coquetterie : la page s'ouvre depuis un téléphone, sur le
 * réseau d'un salon en sous-sol, et un script qui n'arrive pas ne doit pas
 * laisser un commerçant incapable d'annoncer sa fermeture.
 */
export const ESPACE_JS = String.raw`
(() => {
  "use strict";

  const $ = (racine, sel) => racine.querySelector(sel);
  const $$ = (racine, sel) => Array.from(racine.querySelectorAll(sel));

  /* -------------------------------------------------------------- attente */

  const voile = $(document, "[data-voile]");
  const voileTitre = $(document, "[data-voile-titre]");
  const voileMot = $(document, "[data-voile-mot]");
  const voileSecours = $(document, "[data-voile-secours]");

  const minuteries = [];

  const arreterMinuteries = () => {
    for (const m of minuteries) clearTimeout(m);
    minuteries.length = 0;
  };

  /**
   * Montre le voile, et fait vivre son message.
   *
   * Le délai de 400 ms n'est pas une hésitation : les actions rapides — marquer
   * une commande confirmée, mettre une photo en couverture — reviennent avant,
   * et le voile ne fait alors que clignoter, ce qui inquiète au lieu de
   * rassurer. Seules les actions réellement longues le déclenchent.
   */
  function attendre(titre) {
    if (!voile) return;

    minuteries.push(
      setTimeout(() => {
        if (voileTitre) voileTitre.textContent = titre;
        if (voileMot) voileMot.textContent = "Ne fermez pas cette page.";
        if (voileSecours) voileSecours.hidden = true;
        voile.hidden = false;
      }, 400),
    );

    /*
     * Après quinze secondes, on dit que c'est normal. C'est le moment précis
     * où l'on commence à croire que ça a planté — et c'est vrai : le site se
     * reconstruit entièrement, images comprises.
     */
    minuteries.push(
      setTimeout(() => {
        if (voileMot) {
          voileMot.textContent =
            "C'est un peu long, c'est normal : votre site se reconstruit. Ne fermez pas cette page.";
        }
      }, 15000),
    );

    /*
     * Au bout de trois minutes, quelque chose ne va pas — connexion coupée,
     * serveur muet. Le voile ne doit alors pas enfermer le commerçant : on le
     * dit, et on lui rend la main. Le rechargement est sans danger, ses
     * modifications sont enregistrées avant la partie longue.
     */
    minuteries.push(
      setTimeout(() => {
        if (voileTitre) voileTitre.textContent = "Ça prend anormalement longtemps";
        if (voileMot) {
          voileMot.textContent =
            "Votre connexion s'est peut-être interrompue. Rechargez la page : ce que vous avez enregistré est conservé.";
        }
        if (voileSecours) {
          voileSecours.href = location.href;
          voileSecours.hidden = false;
        }
      }, 180000),
    );
  }

  /*
   * ─── Pas d'avertissement « quitter la page ? » ───────────────────────────
   *
   * La tentation était forte : le voile empêche de cliquer dans la page, pas
   * de fermer l'onglet. Mais « beforeunload » se déclenche sur **toute**
   * navigation sortante — y compris celle du formulaire lui-même, quand la
   * réponse arrive. Le commerçant aurait donc vu la boîte « Quitter le site ? »
   * à chaque enregistrement réussi.
   *
   * Un avertissement qui se trompe une fois sur deux apprend à cliquer
   * « Quitter » sans lire, et ne protège alors plus de rien. Essayé, constaté
   * dans un vrai navigateur, retiré.
   *
   * Le voile reste la protection : il occupe l'écran, verrouille le bouton et
   * dit en toutes lettres de ne pas fermer la page.
   */

  /*
   * Retour depuis l'historique : Safari et Firefox restituent la page telle
   * qu'elle était, voile compris. Sans ce nettoyage, revenir en arrière après
   * un enregistrement laisse un voile figé sur une page parfaitement
   * utilisable.
   */
  addEventListener("pageshow", (evenement) => {
    if (!evenement.persisted) return;
    arreterMinuteries();
    if (voile) voile.hidden = true;
    for (const b of $$(document, "button[data-lent]")) {
      b.disabled = false;
      if (b.dataset.libelle) b.textContent = b.dataset.libelle;
    }
  });

  /* ------------------------------------------------------- confirmations */

  document.addEventListener("submit", (evenement) => {
    const question = evenement.target.dataset && evenement.target.dataset.confirmer;
    if (question && !confirm(question)) {
      evenement.preventDefault();
      return;
    }

    /*
     * Le bouton dit ce qu'il fait et se verrouille. Sans cela on appuie une
     * seconde fois, et deux publications du même site se chevauchent.
     *
     * Verrouillé après l'envoi (setTimeout à 0) : désactiver un bouton avant
     * que le navigateur n'ait relevé le formulaire lui ferait oublier ce
     * bouton.
     */
    const bouton = $(evenement.target, "button[data-lent]");
    if (bouton && !evenement.defaultPrevented) {
      // Le libellé d'origine est retenu pour pouvoir être rétabli au retour
      // arrière.
      if (!bouton.dataset.libelle) bouton.dataset.libelle = bouton.textContent.trim();
      const annonce = bouton.dataset.lent;
      setTimeout(() => {
        bouton.disabled = true;
        bouton.textContent = annonce;
      }, 0);
      /*
       * Le titre du voile reprend ce que le bouton annonce — « Mise à jour du
       * site » — moins ses points de suspension : le rond qui tourne dit déjà
       * que c'est en cours, et le caractère « … » se pose trop haut dans cette
       * graisse pour être écrit en grand.
       */
      const titre = (annonce || "").replace(/\s*…\s*$/, "").trim();
      attendre(titre || "Enregistrement en cours");
    }
  });

  /* ------------------------------------------------------------ horaires */

  /*
   * Le champ réellement envoyé est caché : « 09:00-18:00 », ou vide si le jour
   * est fermé. L'interrupteur et les deux heures ne servent qu'à le composer —
   * c'est ce qui permet à la page de fonctionner sans script, le champ caché
   * portant déjà la bonne valeur au chargement.
   */
  for (const jour of $$(document, "[data-jour]")) {
    const ouvert = $(jour, "[data-ouvert]");
    const de = $(jour, "[data-de]");
    const a = $(jour, "[data-a]");
    const cache = $(jour, "input[type=hidden]");
    const mot = $(jour, "[data-mot]");
    if (!ouvert || !de || !a || !cache) continue;

    const composer = () => {
      jour.dataset.ferme = ouvert.checked ? "non" : "oui";
      if (mot) mot.textContent = ouvert.checked ? "Ouvert" : "Fermé";
      if (!ouvert.checked) { cache.value = ""; return; }
      // Une fermeture avant l'ouverture est refusée par le schéma et
      // produirait un message technique : on rétablit une valeur cohérente.
      if (a.value <= de.value) {
        const [h, m] = de.value.split(":").map(Number);
        a.value = String(Math.min(23, h + 8)).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      }
      cache.value = de.value + "-" + a.value;
    };

    ouvert.addEventListener("change", composer);
    de.addEventListener("change", composer);
    a.addEventListener("change", composer);
  }

  /* -------------------------------------------------------------- tarifs */

  const liste = $(document, "[data-liste-tarifs]");
  const modele = $(document, "[data-modele]");

  const renumeroter = () => {
    if (!liste) return;
    $$(liste, "[data-ligne]").forEach((ligne, index) => {
      for (const champ of $$(ligne, "[name]")) {
        champ.name = champ.name.replace(/^services\.[^.]+\./, "services." + index + ".");
      }
    });
  };

  if (liste) {
    liste.addEventListener("click", (evenement) => {
      const bouton = evenement.target.closest("[data-retirer]");
      if (!bouton) return;
      const ligne = bouton.closest("[data-ligne]");
      const nom = $(ligne, "input[type=text]");
      const quoi = nom && nom.value ? nom.value : "cette prestation";
      if (!confirm("Retirer " + quoi + " ? Le retrait prendra effet à l'enregistrement.")) return;
      ligne.remove();
      renumeroter();
    });
  }

  const ajouter = $(document, "[data-ajouter]");
  if (ajouter && liste && modele) {
    ajouter.addEventListener("click", () => {
      liste.appendChild(modele.content.cloneNode(true));
      renumeroter();
      const dernier = $$(liste, "[data-ligne] input[type=text]").pop();
      if (dernier) dernier.focus();
    });
  }

  /* ---------------------------------------------------- dates rapides */

  for (const bouton of $$(document, "[data-raccourci]")) {
    bouton.addEventListener("click", () => {
      const [du, au] = bouton.dataset.raccourci.split("|");
      const debut = $(document, "[data-debut]");
      const fin = $(document, "[data-fin]");
      if (debut) debut.value = du;
      if (fin) fin.value = au;
      // Le bouton retenu se voit : sans retour, on appuie deux fois en croyant
      // que rien ne s'est passé, et l'on ne regarde pas les champs en dessous.
      for (const autre of $$(document, "[data-raccourci]")) autre.classList.add("second");
      bouton.classList.remove("second");
    });
  }

  /* -------------------------------------------------------------- photos */

  const depot = $(document, "[data-depot]");
  if (depot) {
    const fichier = $(depot, "[data-fichier]");
    const formulaire = depot.closest("form");

    // Envoi dès le choix : demander ensuite d'appuyer sur un bouton « Envoyer »
    // fait croire que la photo est partie alors qu'elle attend.
    if (fichier && formulaire) {
      fichier.addEventListener("change", () => {
        if (fichier.files && fichier.files[0]) {
          depot.querySelector("b").textContent = "Envoi…";
          formulaire.submit();
        }
      });

      for (const type of ["dragenter", "dragover"]) {
        depot.addEventListener(type, (e) => { e.preventDefault(); depot.dataset.survol = "oui"; });
      }
      for (const type of ["dragleave", "drop"]) {
        depot.addEventListener(type, () => { depot.dataset.survol = ""; });
      }
      depot.addEventListener("drop", (e) => {
        e.preventDefault();
        const depose = e.dataTransfer && e.dataTransfer.files[0];
        if (!depose) return;
        // DataTransfer vers input file : le seul moyen d'envoyer un fichier
        // déposé par un formulaire ordinaire, sans requête fabriquée.
        const boite = new DataTransfer();
        boite.items.add(depose);
        fichier.files = boite.files;
        depot.querySelector("b").textContent = "Envoi…";
        formulaire.submit();
      });
    }
  }
})();
`;
