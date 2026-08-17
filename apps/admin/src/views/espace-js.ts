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

  /* ------------------------------------------------------- confirmations */

  document.addEventListener("submit", (evenement) => {
    const question = evenement.target.dataset && evenement.target.dataset.confirmer;
    if (question && !confirm(question)) {
      evenement.preventDefault();
      return;
    }

    /*
     * Le bouton dit ce qu'il fait et se verrouille. La mise en ligne prend une
     * minute pendant laquelle rien ne bouge : sans cela on appuie une seconde
     * fois, et deux publications du même site se chevauchent.
     *
     * Verrouillé après l'envoi (setTimeout à 0) : désactiver un bouton avant
     * que le navigateur n'ait relevé le formulaire lui ferait oublier ce
     * bouton.
     */
    const bouton = $(evenement.target, "button[data-lent]");
    if (bouton && !evenement.defaultPrevented) {
      setTimeout(() => {
        bouton.disabled = true;
        bouton.textContent = bouton.dataset.lent;
      }, 0);
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
