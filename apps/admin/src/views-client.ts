import { escape } from "./views.ts";

/**
 * L'espace du commerçant.
 *
 * Une interface distincte de celle de l'exploitant, et non la même avec des
 * boutons masqués. Masquer produit une page conçue pour quelqu'un d'autre, dont
 * il reste les mots — « slug », « publier », « statut du site » — et l'ordre des
 * priorités : la console de l'exploitant s'ouvre sur la liste des trente
 * commerces, celle du coiffeur doit s'ouvrir sur « je ferme jeudi ».
 *
 * ─── Ce que suppose cette interface de son lecteur ────────────────────────
 *
 * Qu'il la consulte sur un téléphone, debout, entre deux clients, une main
 * occupée. D'où : une seule colonne, des cibles larges, aucun tableau, aucune
 * abréviation, et une phrase entière plutôt qu'un pictogramme.
 *
 * Et qu'il ne reviendra pas. Un commerçant ouvre cette page trois fois par an ;
 * rien de ce qu'il aura appris la fois précédente n'est acquis. Chaque page se
 * relit donc de zéro.
 */

export const PAGES = {
  fermetures: {
    titre: "Je ferme",
    sous: "Congés, jour de repos exceptionnel, imprévu",
    icone: "🚪",
  },
  horaires: { titre: "Mes horaires", sous: "Les heures d'ouverture habituelles", icone: "🕘" },
  tarifs: { titre: "Mes tarifs", sous: "Les prestations et leurs prix", icone: "💶" },
  carte: { titre: "Ma carte", sous: "Les plats, les boissons et leurs prix", icone: "📋" },
  planning: { titre: "Mon planning", sous: "Les cours de la semaine", icone: "🗓️" },
  photos: { titre: "Mes photos", sous: "Les images du salon", icone: "📷" },
  presentation: { titre: "Mon texte", sous: "Ce qui est écrit sur le salon", icone: "✍️" },
  apparence: { titre: "Mon style", sous: "L'allure du site et ses couleurs", icone: "🎨" },
  "rendez-vous": { titre: "Mes rendez-vous", sous: "Ce qui est réservé", icone: "📅" },
  commandes: { titre: "Mes commandes", sous: "Les demandes reçues par le site", icone: "🧾" },
  messages: { titre: "Mes messages", sous: "Ce qu'on vous a écrit", icone: "✉️" },
} as const;

export type PageClient = keyof typeof PAGES;

const STYLE = `
:root {
  color-scheme: light;
  --fond: #f7f6f4;
  --carte: #ffffff;
  --texte: #16150f;
  --doux: #6b665c;
  --bord: #e2ded6;
  --accent: #1d3a2a;
  --accent-texte: #ffffff;
  --ok: #1f6b46;
  --ko: #a8321f;
  --alerte-fond: #fdf3e7;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--fond);
  color: var(--texte);
  font: 17px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  /* Le pouce atteint le bas de l'écran, pas le haut : de l'air sous le
     contenu pour que le dernier bouton ne colle pas au bord. */
  padding-bottom: 4rem;
  -webkit-text-size-adjust: 100%;
}
.enveloppe { max-width: 34rem; margin: 0 auto; padding: 0 1.1rem; }

/* Les liens du texte prennent la couleur de l'interface. Le bleu par défaut du
   navigateur, au milieu d'une palette verte, se lit comme un élément étranger
   collé là par erreur. */
a { color: var(--accent); text-underline-offset: 0.15em; }
a:hover { text-decoration: none; }

header.barre {
  background: var(--carte);
  border-bottom: 1px solid var(--bord);
  padding: 0.9rem 0;
  margin-bottom: 1.4rem;
}
.barre__contenu { display: flex; align-items: center; gap: 1rem; justify-content: space-between; }
.barre__nom { font-weight: 600; font-size: 1.05rem; }
.barre__sortie { color: var(--doux); text-decoration: none; font-size: 0.9rem; }

h1 { font-size: 1.6rem; line-height: 1.2; margin: 0 0 0.4rem; letter-spacing: -0.02em; }
h2 { font-size: 1.1rem; margin: 2rem 0 0.6rem; }
p { margin: 0 0 1rem; }
.chapeau { color: var(--doux); margin-bottom: 1.6rem; }
.aide { color: var(--doux); font-size: 0.92rem; }

/* --- Retour ------------------------------------------------------------- */
.retour {
  display: inline-block; margin-bottom: 1.2rem; color: var(--doux);
  text-decoration: none; font-size: 0.95rem;
}
.retour:hover { color: var(--texte); }

/* --- Cartes de l'accueil ------------------------------------------------ */
/* Une action par carte, le titre en gras et l'explication dessous. Une grille
   de pictogrammes seuls obligerait à deviner, et on ne devine pas trois fois
   par an. */
.menu { display: grid; gap: 0.7rem; margin: 0 0 2rem; }
.menu a {
  display: flex; align-items: center; gap: 1rem;
  background: var(--carte); border: 1px solid var(--bord); border-radius: 14px;
  padding: 1rem 1.1rem; text-decoration: none; color: inherit;
  /* 48 px : la cible minimale pour un doigt. */
  min-height: 4rem;
}
.menu a:active { background: #f0efec; }
.menu__icone { font-size: 1.6rem; line-height: 1; }
.menu__texte { display: grid; gap: 0.1rem; }
.menu__texte b { font-size: 1.05rem; }
.menu__texte span { color: var(--doux); font-size: 0.9rem; }
.menu__compte {
  margin-left: auto; background: var(--accent); color: var(--accent-texte);
  border-radius: 980px; padding: 0.1em 0.6em; font-size: 0.85rem; font-weight: 600;
}

/* --- Bandeau d'état ----------------------------------------------------- */
.etat {
  background: var(--carte); border: 1px solid var(--bord); border-radius: 14px;
  padding: 1rem 1.1rem; margin-bottom: 1.4rem;
}
.etat b { display: block; margin-bottom: 0.15rem; }
.etat span { color: var(--doux); font-size: 0.92rem; }
.etat[data-ton="alerte"] { background: var(--alerte-fond); border-color: #e8d4b4; }
.etat__lien { display: inline-block; margin-top: 0.6rem; color: var(--accent); font-weight: 600; }

/* --- Messages ----------------------------------------------------------- */
.flash { border-radius: 12px; padding: 0.9rem 1rem; margin-bottom: 1.3rem; font-weight: 500; }
.flash[data-ton="ok"] { background: #e8f3ec; color: var(--ok); }
.flash[data-ton="ko"] { background: #fbecea; color: var(--ko); }

/* --- Formulaires -------------------------------------------------------- */
form { margin: 0; }
label { display: block; margin-bottom: 1rem; font-weight: 500; }
input[type=text], input[type=date], input[type=time], input[type=email],
input[type=password], input[type=number], textarea, select {
  display: block; width: 100%; margin-top: 0.35rem;
  /* 16 px minimum : en dessous, Safari sur iPhone agrandit la page au premier
     appui dans un champ, et la mise en page part de travers. */
  font: inherit; font-size: 16px;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--bord); border-radius: 10px; background: var(--carte);
  color: inherit;
}
textarea { min-height: 7rem; resize: vertical; }
input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

button, .bouton {
  display: block; width: 100%; min-height: 3.2rem;
  font: inherit; font-size: 1.05rem; font-weight: 600;
  background: var(--accent); color: var(--accent-texte);
  border: 0; border-radius: 12px; padding: 0.85rem 1rem;
  cursor: pointer; text-align: center; text-decoration: none;
}
button:disabled { opacity: 0.75; cursor: progress; }
button.second, .bouton.second {
  background: transparent; color: var(--texte); border: 1px solid var(--bord);
}
button.danger { background: transparent; color: var(--ko); border: 1px solid var(--bord); }
.actions { margin: 1.6rem 0 0.8rem; display: grid; gap: 0.7rem; }

/* Les raccourcis de dates tiennent sur une ligne : empilés, ils repoussaient
   les champs de date sous le pli, et l'on ne voit plus ce qu'ils remplissent. */
.actions--rangee { grid-auto-flow: column; grid-auto-columns: 1fr; }
.actions--rangee button { font-size: 0.92rem; padding: 0.7rem 0.3rem; min-height: 2.9rem; }

/* --- Fiches (fermeture, rendez-vous, message, tarif) -------------------- */
.fiche {
  background: var(--carte); border: 1px solid var(--bord); border-radius: 14px;
  padding: 1rem 1.1rem; margin-bottom: 0.7rem;
}
.fiche__titre { font-weight: 600; margin-bottom: 0.15rem; }
.fiche__detail { color: var(--doux); font-size: 0.92rem; }
.fiche form { margin-top: 0.8rem; }
.fiche button { min-height: 2.6rem; font-size: 0.95rem; }
/* La commande pas encore traitée se repère sans lire : c'est la seule chose
   qu'on cherche en ouvrant la page un lundi matin. */
.marque-neuf {
  display: inline-block; vertical-align: 0.1em; margin-left: 0.4rem;
  background: var(--accent); color: var(--accent-texte);
  border-radius: 980px; padding: 0.05em 0.6em;
  font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* Le mot de la carte est recopié à la main : il se lit mot à mot, ponctuation
   comprise, et mérite d'être détaché du reste. */
.fiche__carte {
  margin: 0.8rem 0 0; padding: 0.7rem 0.9rem;
  background: var(--fond); border-radius: 10px;
  font-size: 0.95rem; line-height: 1.5;
}

.vide {
  text-align: center; color: var(--doux); padding: 2.5rem 1rem;
  background: var(--carte); border: 1px dashed var(--bord); border-radius: 14px;
}

/* --- Espace de cours ---------------------------------------------------- */
/*
 * Une barre plutôt qu'un pourcentage seul. « 7 sur 12 » se lit, mais c'est la
 * longueur du trait qu'on retient en parcourant vingt élèves : le responsable
 * cherche celui qui décroche, pas un chiffre exact.
 */
.jauge {
  height: 0.5rem; border-radius: 980px; background: var(--bord);
  overflow: hidden; margin: 0.45rem 0 0.25rem;
}
.jauge__part { display: block; height: 100%; background: var(--accent); border-radius: 980px; }

/* L'état d'un exercice, en un mot et une couleur. */
.etiquette {
  display: inline-block; font-size: 0.75rem; font-weight: 600;
  letter-spacing: 0.03em; text-transform: uppercase;
  border: 1px solid var(--bord); border-radius: 980px; padding: 0.15em 0.7em;
  background: var(--carte); color: var(--doux);
}
.etiquette[data-etat="rendu"] { background: var(--accent); color: var(--accent-texte); border-color: var(--accent); }
.etiquette[data-etat="acquis"] { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
.etiquette[data-etat="a-revoir"] { color: var(--ko); border-color: color-mix(in srgb, var(--ko) 45%, transparent); }
.etiquette[data-retard="oui"] { background: var(--ko); color: #fff; border-color: var(--ko); }
.etiquette[data-brouillon="oui"] { border-style: dashed; }

/*
 * Le lien d'invitation, à recopier ou à envoyer soi-même quand le courriel
 * n'arrive pas. Coupé n'importe où plutôt que débordant : sur un téléphone,
 * une adresse longue pousse toute la page de travers.
 */
.copiable {
  display: block; word-break: break-all; margin: 0.6rem 0 0;
  background: var(--fond); border-radius: 10px; padding: 0.6rem 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem;
}

/* La réponse d'un élève, recopiée telle qu'il l'a tapée — retours à la ligne
   compris, sinon un raisonnement en trois points devient un pavé. */
.copie {
  margin: 0.7rem 0 0; padding: 0.75rem 0.9rem; background: var(--fond);
  border-radius: 10px; white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5;
}
.copie[data-de="professeur"] { background: #eef2ef; }

/* --- Horaires ----------------------------------------------------------- */
/* Une ligne par jour : le nom, un interrupteur ouvert/fermé, deux heures.
   Quatorze champs horaires côte à côte sur un téléphone sont inutilisables. */
.jour {
  background: var(--carte); border: 1px solid var(--bord); border-radius: 14px;
  padding: 0.9rem 1rem; margin-bottom: 0.6rem;
}
.jour__tete { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.jour__nom { font-weight: 600; }
.jour__heures { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.8rem; }
.jour__heures input { margin-top: 0; }
.jour__heures span { color: var(--doux); }
.jour[data-ferme="oui"] .jour__heures { display: none; }

/* Interrupteur ouvert/fermé, dessiné avec une case à cocher : lisible, et il
   fonctionne sans JavaScript. */
.bascule { display: inline-flex; align-items: center; gap: 0.55rem; cursor: pointer; margin: 0; font-weight: 500; }
.bascule input { position: absolute; opacity: 0; pointer-events: none; }
.bascule__piste {
  width: 3.1rem; height: 1.8rem; border-radius: 980px; background: #d8d4cc;
  position: relative; transition: background 0.15s; flex: none;
}
.bascule__piste::after {
  content: ""; position: absolute; top: 3px; left: 3px;
  width: 1.4rem; height: 1.4rem; border-radius: 50%; background: #fff;
  transition: transform 0.15s;
}
.bascule input:checked + .bascule__piste { background: var(--ok); }
.bascule input:checked + .bascule__piste::after { transform: translateX(1.3rem); }
.bascule input:focus-visible + .bascule__piste { outline: 2px solid var(--accent); outline-offset: 2px; }
.bascule__mot { font-size: 0.95rem; color: var(--doux); }

/* --- Listes modifiables (tarifs) ---------------------------------------- */
.ligne {
  background: var(--carte); border: 1px solid var(--bord); border-radius: 14px;
  padding: 1rem; margin-bottom: 0.7rem;
}
.ligne__paire { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
.ligne label { margin-bottom: 0.7rem; }
.ligne__retirer {
  background: none; border: 0; color: var(--ko); font-size: 0.92rem;
  width: auto; min-height: 2.2rem; padding: 0; text-align: left; font-weight: 500;
}
/* Les régimes : des cases larges, atteignables au pouce. Le doigt vise une
   pastille entière, pas une case à cocher de trois millimètres. */
.ligne__cases { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.7rem; }
.case {
  display: flex; align-items: center; gap: 0.45rem; margin: 0; cursor: pointer;
  border: 1px solid var(--bord); border-radius: 980px;
  padding: 0.4em 0.9em; font-size: 0.92rem; background: var(--carte);
}
.case:has(input:checked) { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.case input { margin: 0; width: auto; }

/* --- Photos ------------------------------------------------------------- */
.photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 0.7rem; }
.photo { background: var(--carte); border: 1px solid var(--bord); border-radius: 12px; overflow: hidden; }
.photo img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; }
.photo__pied { padding: 0.5rem 0.6rem; display: grid; gap: 0.35rem; }
.photo__pied button { min-height: 2.2rem; font-size: 0.85rem; padding: 0.35rem; }
.photo__marque { font-size: 0.8rem; color: var(--ok); font-weight: 600; text-align: center; }

.depot {
  display: block; text-align: center; padding: 2rem 1rem; margin-bottom: 1.2rem;
  background: var(--carte); border: 2px dashed var(--bord); border-radius: 14px;
  cursor: pointer;
}
.depot[data-survol="oui"] { border-color: var(--accent); background: #eef2ef; }
.depot input { position: absolute; opacity: 0; pointer-events: none; }
.depot b { display: block; font-size: 1.05rem; }
.depot span { color: var(--doux); font-size: 0.9rem; }

/* --- Choix du style et de la couleur ------------------------------------ */
/*
 * Le balisage vient de views/apparence-choix.ts, partagé avec la console de
 * l'exploitant : une seule liste de styles, donc aucune chance qu'un style
 * ajouté n'apparaisse que d'un côté. Seul l'habillage change, pour tenir sur
 * un téléphone.
 */
.choix-grille {
  display: grid; gap: 0.8rem; margin-bottom: 2rem;
  grid-template-columns: repeat(auto-fill, minmax(min(14rem, 100%), 1fr));
}
.choix {
  display: grid; gap: 0.8rem; margin: 0; cursor: pointer;
  background: var(--carte); border: 1px solid var(--bord);
  border-radius: 14px; padding: 0.9rem;
}
/* Le choix retenu est cerné franchement : cette page s'ouvre d'abord pour
   savoir ce qui est appliqué, et seulement ensuite pour en changer. */
.choix:has(input:checked) { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
.choix input { position: absolute; opacity: 0; pointer-events: none; }
.choix__texte { display: grid; gap: 0.2rem; font-size: 0.88rem; }
.choix__texte b { font-size: 1rem; }
.choix__texte span { color: var(--doux); }

.vignette {
  display: grid; gap: 0.5rem; justify-items: start;
  padding: 0.9rem; border: 1px solid; border-radius: 10px; min-height: 6.5rem;
}
.vignette__titre { font-size: 1.9rem; line-height: 1; }
.vignette__filet { display: block; width: 100%; height: 1px; }
.vignette__btn { font-size: 0.66rem; padding: 0.45em 1.1em; }

.marque {
  font-size: 0.66rem; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ok);
  border: 1px solid color-mix(in srgb, var(--ok) 45%, transparent);
  border-radius: 980px; padding: 0.1em 0.55em; margin-left: 0.4rem;
  vertical-align: 0.12em;
}

.teinte-grille {
  display: grid; gap: 0.6rem; margin-bottom: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(min(7.5rem, 100%), 1fr));
}
.teinte {
  display: grid; gap: 0.45rem; margin: 0; cursor: pointer; text-align: center;
  background: var(--carte); border: 1px solid var(--bord);
  border-radius: 12px; padding: 0.65rem; font-size: 0.88rem;
}
.teinte:has(input:checked) { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
.teinte input { position: absolute; opacity: 0; pointer-events: none; }
.teinte b { display: block; font-weight: 600; }
.teinte__pastilles {
  display: flex; height: 2rem; border-radius: 8px; overflow: hidden;
  border: 1px solid var(--bord);
}
.teinte__pastilles span { flex: 1; }

/* --- Voile d'attente ---------------------------------------------------- */
/*
 * Ce que voyait le commerçant jusqu'ici : un bouton grisé. La mise en ligne
 * prend une minute pleine, pendant laquelle la page ne bouge plus — on croit
 * que ça a planté, on revient en arrière, et l'enregistrement se perd à
 * mi-chemin.
 *
 * Le voile occupe tout l'écran parce que c'est le seul moyen d'être vu sur un
 * téléphone tenu à bout de bras, et parce qu'il empêche physiquement de
 * réappuyer.
 */
.voile {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  /* Opaque à 92 % plutôt que translucide : sur un fond clair, un voile trop
     transparent laisse lire la page et n'a plus l'air d'un état d'attente. */
  background: color-mix(in srgb, var(--fond) 92%, transparent);
  backdrop-filter: blur(3px);
  animation: voile-entree 0.18s ease-out;
}
.voile[hidden] { display: none; }

@keyframes voile-entree {
  from { opacity: 0; }
  to { opacity: 1; }
}

.voile__boite {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  text-align: center;
  max-width: 22rem;
}

/*
 * Un rond de 4,5 rem : assez grand pour se voir d'un coup d'œil, assez sobre
 * pour ne pas ressembler à une alerte. L'arc clair tourne, le reste est un
 * anneau fixe — c'est ce contraste qui donne le mouvement, pas la vitesse.
 */
.voile__rond {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  border: 5px solid var(--bord);
  border-top-color: var(--accent);
  animation: voile-tourne 0.9s linear infinite;
  margin-bottom: 0.6rem;
}

@keyframes voile-tourne {
  to { transform: rotate(360deg); }
}

.voile__titre { font-size: 1.2rem; }
.voile__mot { color: var(--doux); font-size: 0.95rem; line-height: 1.5; }
.voile__secours {
  margin-top: 0.9rem;
  font-weight: 600;
}

/*
 * Mouvement réduit : une rotation continue peut provoquer des vertiges, et
 * c'est un réglage que les gens activent parce qu'ils en ont besoin. Le rond
 * respire au lieu de tourner — l'attente reste lisible, le mouvement disparaît.
 */
@media (prefers-reduced-motion: reduce) {
  .voile { animation: none; }
  .voile__rond {
    animation: voile-respire 1.6s ease-in-out infinite;
    border-top-color: var(--accent);
  }
  @keyframes voile-respire {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 1; }
  }
}

/* --- Connexion ---------------------------------------------------------- */
.connexion { max-width: 24rem; margin: 3rem auto; }
.connexion h1 { text-align: center; }
`;

export function layoutClient(
  titre: string,
  corps: string,
  options: { nomCommerce?: string; retour?: string; script?: boolean } = {},
): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#f7f6f4">
<title>${escape(titre)}</title>
<style>${STYLE}</style>
</head>
<body>
${
  options.nomCommerce
    ? `<header class="barre">
  <div class="enveloppe barre__contenu">
    <span class="barre__nom">${escape(options.nomCommerce)}</span>
    <a class="barre__sortie" href="/deconnexion">Se déconnecter</a>
  </div>
</header>`
    : ""
}
<main class="enveloppe">
${options.retour ? `<a class="retour" href="${escape(options.retour)}">← Retour</a>` : ""}
${corps}
</main>

<!--
  Voile d'attente.

  Toujours présent, jamais visible tant qu'on n'enregistre pas. Écrit dans le
  balisage plutôt que fabriqué par le script : il doit pouvoir s'afficher à
  l'instant même où l'on appuie, sans attendre que quoi que ce soit se
  construise.

  « aria-live » et le rôle « alert » le font annoncer par les lecteurs d'écran :
  quelqu'un qui n'y voit pas doit lui aussi savoir qu'il faut patienter.
-->
<div class="voile" data-voile hidden>
  <div class="voile__boite" role="alert" aria-live="assertive">
    <div class="voile__rond" aria-hidden="true"></div>
    <b class="voile__titre" data-voile-titre>Enregistrement en cours</b>
    <span class="voile__mot" data-voile-mot>Ne fermez pas cette page.</span>
    <a class="voile__secours" href="" data-voile-secours hidden>Recharger la page</a>
  </div>
</div>
${options.script ? `<script src="/assets/espace.js" defer></script>` : ""}
</body>
</html>`;
}

export function message(ton: "ok" | "ko", texte: string): string {
  return `<p class="flash" data-ton="${ton}">${escape(texte)}</p>`;
}

/**
 * « lundi 3 mars », sans l'année quand c'est cette année.
 *
 * Accepte une chaîne ISO ou un objet Date : le pilote Postgres renvoie les
 * colonnes `date` sous forme d'objets, et `String(date).slice(0, 10)` donnait
 * « Fri Aug 21 » — que `new Date()` refuse, si bien que la fonction rendait
 * cette bouillie telle quelle au commerçant.
 */
export function dateLisible(valeur: string | Date): string {
  const date =
    valeur instanceof Date ? valeur : new Date(`${valeur}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(valeur);
  const memeAnnee = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(memeAnnee ? {} : { year: "numeric" }),
  });
}

/** Décrit une période de fermeture en une phrase. */
export function periodeLisible(du: string, au: string): string {
  return du === au ? dateLisible(du) : `du ${dateLisible(du)} au ${dateLisible(au)}`;
}

/*
 * Le mot « tarifs » convient à un coiffeur, moins à un fleuriste, dont la carte
 * change au fil des saisons. Un seul libellé à remplacer suffit ; le reste du
 * vocabulaire de l'espace vaut pour les deux.
 */
export const TITRES_METIER: Record<string, Partial<Record<PageClient, string>>> = {
  fleuriste: {
    tarifs: "Mes compositions",
    photos: "Mes photos",
  },
  patisserie: { tarifs: "Mes produits" },
  chocolatier: { tarifs: "Mes chocolats" },
  boucherie: { tarifs: "Mes produits" },
  caviste: { tarifs: "Ma sélection" },
  traiteur: { tarifs: "Mes formules", commandes: "Mes demandes de devis" },
  spa: { tarifs: "Mes soins" },
  ongles: { photos: "Mes réalisations" },
  tatouage: { photos: "Mon book", commandes: "Mes demandes de projet" },
  sport: { tarifs: "Mes formules" },
  /*
   * Un restaurateur ne dit pas « mes commandes » : il dit « mes réservations ».
   * Le mot compte plus qu'ailleurs — c'est la page qu'il ouvrira en service,
   * entre deux tables.
   */
  restaurant: { tarifs: "Mes formules", commandes: "Mes demandes de table" },
  cafe: { tarifs: "Mes formules" },
  snack: { tarifs: "Mes formules" },
  epicerie: { tarifs: "Ma sélection" },
  boutique: { tarifs: "Mes services" },
  ecole: { tarifs: "Mes formules", planning: "Mes cours" },
  photo: { tarifs: "Mes formules", commandes: "Mes demandes de devis" },
};

export function titrePage(metierId: string, page: PageClient): string {
  return TITRES_METIER[metierId]?.[page] ?? PAGES[page].titre;
}
