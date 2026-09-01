import { escape } from "./views.ts";
import { MOT_ETAT, type Avancement, type EtatTravail } from "./ecole.ts";
import type { HautFait, JourDeSemaine, Niveau } from "./jeu.ts";

/**
 * L'habillage de l'espace de cours.
 *
 * ─── Pourquoi sa propre feuille de style, et non celle du commerçant ──────
 *
 * L'espace commerçant est écrit pour quelqu'un qui l'ouvre trois fois par an,
 * debout, une main occupée : tout y est large, plat, et se relit de zéro. Un
 * élève, lui, ouvre le sien trois soirs par semaine, assis, et il y reste
 * vingt minutes. Ce ne sont pas les mêmes contraintes, et une interface conçue
 * pour l'un, servie à l'autre avec deux boutons masqués, se reconnaît toujours
 * — il en reste les mots et l'ordre des priorités.
 *
 * D'où une identité distincte : indigo plutôt que vert, une hiérarchie plus
 * dense, et de quoi montrer une progression, ce que l'espace commerçant n'a
 * jamais eu à faire.
 *
 * ─── Ce que cette feuille contient et ne contient pas ─────────────────────
 *
 * Pas une ligne de JavaScript. L'anneau de progression est un cercle SVG dont
 * la longueur est calculée sur le serveur, la frise de la semaine sept
 * pastilles, les hauts faits une grille. Tout arrive dessiné. C'est ce qui
 * permet à la page de s'afficher juste sur un téléphone à réseau faible dans
 * un tram — et la politique de sécurité de la console interdit de toute façon
 * le script en ligne.
 *
 * Le mode sombre est traité, parce qu'un élève révise le soir.
 */

const STYLE = `
:root {
  color-scheme: light dark;

  --fond: #f4f4fb;
  --fond-creux: #ececf7;
  --carte: #ffffff;
  --texte: #16151f;
  --doux: #63627a;
  --bord: #e2e1f0;
  --bord-fort: #cfcee3;

  --accent: #4338ca;
  --accent-clair: #eef0fe;
  --accent-texte: #ffffff;

  --ok: #047857;
  --ok-fond: #e6f5ef;
  --ko: #be123c;
  --ko-fond: #fdecef;
  --feu: #c2620a;
  --feu-fond: #fdf1e3;

  --ombre: 0 1px 2px rgba(22, 21, 31, 0.05), 0 8px 24px -16px rgba(22, 21, 31, 0.18);
  --rayon: 16px;
}

/*
 * Le soir, la lampe éteinte, une page blanche pleine écran fait mal aux yeux
 * et fait fermer l'onglet. Les mêmes noms, d'autres valeurs : aucune règle
 * plus bas n'a à savoir dans quel mode elle s'affiche.
 */
@media (prefers-color-scheme: dark) {
  :root {
    --fond: #101019;
    --fond-creux: #17172a;
    --carte: #1a1a2b;
    --texte: #ecebf5;
    --doux: #a3a1bd;
    --bord: #2b2a42;
    --bord-fort: #3d3b5c;

    --accent: #a5b4fc;
    --accent-clair: #23234a;
    --accent-texte: #14142a;

    --ok: #34d399;
    --ok-fond: #10291f;
    --ko: #fb7185;
    --ko-fond: #2c1520;
    --feu: #fbbf24;
    --feu-fond: #2c2110;

    --ombre: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--fond);
  color: var(--texte);
  font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  /* Le pouce atteint le bas de l'écran : de l'air sous le dernier bouton. */
  padding-bottom: 4rem;
  -webkit-text-size-adjust: 100%;
}

.enveloppe { max-width: 36rem; margin: 0 auto; padding: 0 1.05rem; }

a { color: var(--accent); text-underline-offset: 0.15em; }
a:hover { text-decoration: none; }

h1 { font-size: 1.55rem; line-height: 1.18; margin: 0 0 0.35rem; letter-spacing: -0.021em; }
h2 {
  font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--doux); margin: 2.2rem 0 0.75rem; font-weight: 700;
}
p { margin: 0 0 1rem; }
.chapeau { color: var(--doux); margin-bottom: 1.5rem; }
.aide { color: var(--doux); font-size: 0.9rem; }

/* --- Barre du haut ------------------------------------------------------ */
header.barre {
  background: var(--carte);
  border-bottom: 1px solid var(--bord);
  padding: 0.85rem 0;
  margin-bottom: 1.3rem;
}
.barre__contenu { display: flex; align-items: center; gap: 0.9rem; justify-content: space-between; }
.barre__nom {
  font-weight: 650; font-size: 1rem; letter-spacing: -0.01em;
  display: flex; align-items: center; gap: 0.5rem; min-width: 0;
}
.barre__nom span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.barre__ecusson {
  width: 1.7rem; height: 1.7rem; flex: none; border-radius: 9px;
  background: var(--accent); color: var(--accent-texte);
  display: grid; place-items: center; font-size: 0.85rem; font-weight: 700;
}
.barre__sortie { color: var(--doux); text-decoration: none; font-size: 0.88rem; flex: none; }

.retour {
  display: inline-block; margin-bottom: 1.1rem; color: var(--doux);
  text-decoration: none; font-size: 0.93rem;
}
.retour:hover { color: var(--texte); }

/* --- Le tableau de bord de l'élève -------------------------------------- */
/*
 * Une seule carte, en tête, qui répond aux trois questions de celui qui ouvre
 * l'application : où j'en suis, combien j'ai, et est-ce que ma série tient.
 * Trois cartes séparées auraient poussé la liste d'exercices sous le pli, et
 * c'est elle qu'on vient chercher.
 */
.tableau {
  background: var(--carte); border: 1px solid var(--bord); border-radius: var(--rayon);
  box-shadow: var(--ombre); padding: 1.1rem; margin-bottom: 1.1rem;
}
.tableau__haut { display: flex; align-items: center; gap: 1.1rem; }
.tableau__texte { min-width: 0; }
.tableau__niveau { font-size: 1.18rem; font-weight: 700; letter-spacing: -0.015em; }
.tableau__rang {
  display: inline-block; margin-left: 0.4rem; vertical-align: 0.12em;
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  background: var(--accent-clair); color: var(--accent);
  border-radius: 980px; padding: 0.18em 0.6em;
}
.tableau__points { color: var(--doux); font-size: 0.92rem; margin-top: 0.15rem; }

/* --- Anneau de progression ---------------------------------------------- */
.anneau { flex: none; position: relative; width: 5.4rem; height: 5.4rem; }
.anneau svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }
.anneau__piste { fill: none; stroke: var(--fond-creux); stroke-width: 9; }
.anneau__part {
  fill: none; stroke: var(--accent); stroke-width: 9; stroke-linecap: round;
}
.anneau__centre {
  position: absolute; inset: 0; display: grid; place-content: center; text-align: center;
}
.anneau__valeur { font-size: 1.15rem; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; }
.anneau__mot { font-size: 0.62rem; color: var(--doux); text-transform: uppercase; letter-spacing: 0.06em; }

/* --- Barre de niveau ----------------------------------------------------- */
.niveau { margin-top: 1rem; }
.niveau__piste {
  height: 0.5rem; border-radius: 980px; background: var(--fond-creux); overflow: hidden;
}
.niveau__part {
  display: block; height: 100%; border-radius: 980px;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--feu)));
}
.niveau__mots {
  display: flex; justify-content: space-between; gap: 1rem;
  font-size: 0.82rem; color: var(--doux); margin-top: 0.4rem;
}

/* --- Série --------------------------------------------------------------- */
/*
 * Deux lignes plutôt qu'une : la phrase et la frise se disputaient la largeur
 * d'un téléphone, et « ne la cassez pas » se retrouvait à quatre mots empilés
 * sur quatre lignes. Le compte et la phrase d'abord, la frise dessous.
 */
.serie {
  display: grid; grid-template-columns: auto 1fr; gap: 0.3rem 0.75rem;
  align-items: baseline; margin-top: 1rem;
  padding-top: 0.95rem; border-top: 1px solid var(--bord);
}
.serie__compte {
  display: flex; align-items: baseline; gap: 0.3rem; flex: none;
  color: var(--feu); font-weight: 700;
}
.serie__compte b { font-size: 1.3rem; letter-spacing: -0.02em; }
.serie__compte span { font-size: 0.8rem; font-weight: 600; }
.serie__mot { color: var(--doux); font-size: 0.85rem; }

.frise { display: flex; gap: 0.32rem; grid-column: 1 / -1; margin-top: 0.5rem; }
.frise__jour {
  width: 1.55rem; display: grid; gap: 0.22rem; justify-items: center;
  font-size: 0.63rem; color: var(--doux);
}
.frise__pastille {
  width: 1.4rem; height: 1.4rem; border-radius: 8px;
  background: var(--fond-creux); border: 1px solid transparent;
  display: grid; place-items: center; font-size: 0.7rem; line-height: 1;
}
.frise__jour[data-actif="oui"] .frise__pastille {
  background: var(--feu-fond); border-color: color-mix(in srgb, var(--feu) 35%, transparent);
}
.frise__jour[data-aujourdhui="oui"] .frise__pastille { outline: 2px solid var(--accent); outline-offset: 1px; }

/* --- Tuiles de comptage (côté professeur) -------------------------------- */
.tuiles {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.6rem; margin-bottom: 1.3rem;
}
.tuile {
  background: var(--carte); border: 1px solid var(--bord); border-radius: 13px;
  padding: 0.8rem 0.9rem; text-decoration: none; color: inherit; display: block;
}
.tuile b { display: block; font-size: 1.5rem; letter-spacing: -0.03em; line-height: 1.1; }
.tuile span { color: var(--doux); font-size: 0.82rem; }
.tuile[data-ton="alerte"] { background: var(--feu-fond); border-color: color-mix(in srgb, var(--feu) 30%, transparent); }
.tuile[data-ton="alerte"] b { color: var(--feu); }

/* --- Bandeau ------------------------------------------------------------- */
.etat {
  background: var(--carte); border: 1px solid var(--bord); border-radius: var(--rayon);
  padding: 1rem 1.05rem; margin-bottom: 1.2rem;
}
.etat b { display: block; margin-bottom: 0.15rem; }
.etat span { color: var(--doux); font-size: 0.9rem; }
.etat[data-ton="alerte"] { background: var(--feu-fond); border-color: color-mix(in srgb, var(--feu) 30%, transparent); }
.etat[data-ton="fete"] { background: var(--accent-clair); border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
.etat__lien { display: inline-block; margin-top: 0.55rem; color: var(--accent); font-weight: 650; }

/* --- Message ------------------------------------------------------------- */
.flash {
  border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 1.2rem; font-weight: 550;
  border: 1px solid transparent;
}
.flash[data-ton="ok"] { background: var(--ok-fond); color: var(--ok); border-color: color-mix(in srgb, var(--ok) 25%, transparent); }
.flash[data-ton="ko"] { background: var(--ko-fond); color: var(--ko); border-color: color-mix(in srgb, var(--ko) 25%, transparent); }

/* --- Exercices ----------------------------------------------------------- */
/*
 * Un liseré de couleur à gauche plutôt qu'une pastille seule : dans une liste
 * de vingt, c'est la seule chose qui se voit sans lire. Le pictogramme
 * confirme, le mot tranche.
 */
.exos { display: grid; gap: 0.55rem; }
.exo {
  display: flex; align-items: center; gap: 0.85rem;
  background: var(--carte); border: 1px solid var(--bord); border-radius: 14px;
  border-left: 4px solid var(--bord-fort);
  padding: 0.85rem 1rem; text-decoration: none; color: inherit;
  min-height: 3.9rem;
  box-shadow: var(--ombre);
}
.exo:active { background: var(--fond-creux); }
.exo[data-etat="acquis"] { border-left-color: var(--ok); }
.exo[data-etat="a-revoir"] { border-left-color: var(--feu); }
.exo[data-etat="rendu"] { border-left-color: var(--accent); }
.exo[data-etat="commence"] { border-left-color: var(--bord-fort); }
.exo[data-retard="oui"] { border-left-color: var(--ko); }

/* Largeur fixe : un « ○ » et un « ✅ » n'ont pas la même chasse, et les
   titres se décalaient d'une carte à l'autre. */
.exo__icone {
  font-size: 1.3rem; line-height: 1; flex: none;
  width: 1.6rem; text-align: center; color: var(--doux);
}
.exo__texte { min-width: 0; display: grid; gap: 0.22rem; }
.exo__titre { font-weight: 620; letter-spacing: -0.01em; }
.exo__sous { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.exo__fleche { margin-left: auto; color: var(--doux); flex: none; }

/* --- Étiquettes ---------------------------------------------------------- */
.puce {
  display: inline-block; font-size: 0.72rem; font-weight: 650;
  border-radius: 980px; padding: 0.16em 0.62em;
  background: var(--fond-creux); color: var(--doux); border: 1px solid transparent;
  white-space: nowrap;
}
.puce[data-etat="rendu"] { background: var(--accent-clair); color: var(--accent); }
.puce[data-etat="acquis"] { background: var(--ok-fond); color: var(--ok); }
.puce[data-etat="a-revoir"] { background: var(--feu-fond); color: var(--feu); }
.puce[data-ton="retard"] { background: var(--ko-fond); color: var(--ko); }
.puce[data-ton="brouillon"] { border-style: dashed; border-color: var(--bord-fort); }
.puce[data-ton="matiere"] { background: transparent; border-color: var(--bord-fort); }

/* --- Hauts faits --------------------------------------------------------- */
/*
 * Tous montrés, jamais cachés. Un haut fait secret ne se découvre qu'une fois
 * décroché, c'est-à-dire quand il ne sert plus à rien ; « 3 sur 5 » est une
 * invitation, un cadenas n'en est pas une.
 */
.faits {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.55rem;
}
.fait {
  background: var(--carte); border: 1px solid var(--bord); border-radius: 13px;
  padding: 0.75rem 0.5rem; text-align: center; display: grid; gap: 0.28rem;
  justify-items: center; align-content: start;
}
.fait__jeton {
  width: 2.5rem; height: 2.5rem; border-radius: 50%; display: grid; place-items: center;
  font-size: 1.25rem; background: var(--fond-creux);
  /* Un haut fait non obtenu reste lisible mais éteint : on doit voir ce qu'on
     vise sans croire qu'on l'a déjà. */
  filter: grayscale(1); opacity: 0.45;
}
/* Deux lignes réservées : « Trois jours de suite » en prend deux, « Obtenu »
   une seule, et sans cette réserve la grille prenait l'air d'un escalier. */
.fait__nom { font-size: 0.76rem; font-weight: 620; line-height: 1.25; min-height: 2.5em; }
.fait__compte { font-size: 0.7rem; color: var(--doux); font-variant-numeric: tabular-nums; }
.fait[data-obtenu="oui"] {
  background: var(--accent-clair); border-color: color-mix(in srgb, var(--accent) 30%, transparent);
}
.fait[data-obtenu="oui"] .fait__jeton {
  filter: none; opacity: 1; background: var(--carte);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent);
}
.fait[data-obtenu="oui"] .fait__compte { color: var(--accent); font-weight: 650; }

/* --- Classement ---------------------------------------------------------- */
.rangs { display: grid; gap: 0.4rem; }
.rang {
  display: flex; align-items: center; gap: 0.8rem;
  background: var(--carte); border: 1px solid var(--bord); border-radius: 13px;
  padding: 0.7rem 0.9rem;
}
.rang__place {
  width: 1.9rem; height: 1.9rem; flex: none; border-radius: 50%;
  background: var(--fond-creux); color: var(--doux);
  display: grid; place-items: center; font-size: 0.82rem; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.rang[data-place="1"] .rang__place { background: #fdf1e3; color: #b45309; }
.rang[data-place="2"] .rang__place { background: #eeeef4; color: #52525b; }
.rang[data-place="3"] .rang__place { background: #f6ece4; color: #9a5b26; }
.rang__nom { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rang__niveau { color: var(--doux); font-size: 0.8rem; }
.rang__points { margin-left: auto; flex: none; font-weight: 700; font-variant-numeric: tabular-nums; }
.rang[data-moi="oui"] { border-color: var(--accent); background: var(--accent-clair); }

/* --- Cartes de navigation ------------------------------------------------ */
.menu { display: grid; gap: 0.55rem; margin: 0 0 1.6rem; }
.menu a {
  display: flex; align-items: center; gap: 0.95rem;
  background: var(--carte); border: 1px solid var(--bord); border-radius: 14px;
  padding: 0.95rem 1rem; text-decoration: none; color: inherit; min-height: 3.9rem;
  box-shadow: var(--ombre);
}
.menu a:active { background: var(--fond-creux); }
.menu__icone { font-size: 1.45rem; line-height: 1; flex: none; }
.menu__texte { display: grid; gap: 0.1rem; min-width: 0; }
.menu__texte b { font-size: 1rem; letter-spacing: -0.01em; }
.menu__texte span { color: var(--doux); font-size: 0.87rem; }
.menu__compte {
  margin-left: auto; flex: none; background: var(--accent); color: var(--accent-texte);
  border-radius: 980px; padding: 0.12em 0.62em; font-size: 0.82rem; font-weight: 700;
}

/* --- Fiches (côté professeur) -------------------------------------------- */
.fiche {
  background: var(--carte); border: 1px solid var(--bord); border-radius: 14px;
  padding: 0.95rem 1rem; margin-bottom: 0.6rem; box-shadow: var(--ombre);
}
.fiche__titre { font-weight: 640; letter-spacing: -0.01em; margin-bottom: 0.2rem; }
.fiche__titre a { text-decoration: none; }
.fiche__titre a:hover { text-decoration: underline; }
.fiche__detail { color: var(--doux); font-size: 0.88rem; }
.fiche__puces { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.5rem 0 0; }
.fiche form { margin-top: 0.75rem; }
.fiche button { min-height: 2.6rem; font-size: 0.92rem; }

.vide {
  text-align: center; color: var(--doux); padding: 2.2rem 1rem;
  background: var(--carte); border: 1px dashed var(--bord-fort); border-radius: var(--rayon);
}

/* --- Textes recopiés ----------------------------------------------------- */
.copie {
  margin: 0.7rem 0 0; padding: 0.8rem 0.95rem; background: var(--fond-creux);
  border-radius: 12px; white-space: pre-wrap; font-size: 0.95rem; line-height: 1.55;
}
.copie[data-de="professeur"] {
  background: var(--accent-clair);
  border-left: 3px solid color-mix(in srgb, var(--accent) 45%, transparent);
}
.copiable {
  display: block; word-break: break-all; margin: 0.6rem 0 0;
  background: var(--carte); border: 1px solid var(--bord-fort); border-radius: 10px;
  padding: 0.6rem 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82rem;
}

/* --- Formulaires --------------------------------------------------------- */
form { margin: 0; }
label { display: block; margin-bottom: 0.95rem; font-weight: 550; font-size: 0.94rem; }
input[type=text], input[type=date], input[type=email],
input[type=password], input[type=number], textarea, select {
  display: block; width: 100%; margin-top: 0.35rem;
  /* 16 px minimum : en dessous, Safari sur iPhone agrandit la page au premier
     appui dans un champ, et la mise en page part de travers. */
  font: inherit; font-size: 16px;
  padding: 0.68rem 0.78rem;
  border: 1px solid var(--bord-fort); border-radius: 11px;
  background: var(--carte); color: inherit;
}
textarea { min-height: 8rem; resize: vertical; line-height: 1.55; }
input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

button, .bouton {
  display: block; width: 100%; min-height: 3.05rem;
  font: inherit; font-size: 1rem; font-weight: 650;
  background: var(--accent); color: var(--accent-texte);
  border: 0; border-radius: 12px; padding: 0.8rem 1rem;
  cursor: pointer; text-align: center; text-decoration: none;
}
button:disabled { opacity: 0.75; cursor: progress; }
button.second, .bouton.second {
  background: var(--carte); color: var(--texte); border: 1px solid var(--bord-fort);
}
button.danger { background: transparent; color: var(--ko); border: 1px solid var(--bord-fort); }
.actions { margin: 1.4rem 0 0.7rem; display: grid; gap: 0.6rem; }

.cases { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.9rem; }
.case {
  display: flex; align-items: center; gap: 0.45rem; margin: 0; cursor: pointer;
  border: 1px solid var(--bord-fort); border-radius: 980px;
  padding: 0.42em 0.95em; font-size: 0.92rem; background: var(--carte);
}
.case:has(input:checked) { border-color: var(--accent); background: var(--accent-clair); color: var(--accent); }
.case input { margin: 0; width: auto; }

.connexion { max-width: 24rem; margin: 2.5rem auto; }
.connexion h1 { text-align: center; }

/*
 * Mouvement réduit : c'est un réglage que les gens activent parce qu'ils en
 * ont besoin. Rien d'essentiel ne dépend d'une animation ici — la retirer ne
 * retire aucune information.
 */
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`;

/* -------------------------------------------------------------------------- */
/* Gabarit                                                                    */
/* -------------------------------------------------------------------------- */

export function layoutEcole(
  titre: string,
  corps: string,
  options: { nom?: string; retour?: string } = {},
): string {
  const initiale = (options.nom ?? "").trim().charAt(0).toUpperCase() || "•";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1a2b" media="(prefers-color-scheme: dark)">
<title>${escape(titre)}</title>
<style>${STYLE}</style>
</head>
<body>
${
  options.nom
    ? `<header class="barre">
  <div class="enveloppe barre__contenu">
    <span class="barre__nom">
      <span class="barre__ecusson" aria-hidden="true">${escape(initiale)}</span>
      <span>${escape(options.nom)}</span>
    </span>
    <a class="barre__sortie" href="/deconnexion">Se déconnecter</a>
  </div>
</header>`
    : ""
}
<main class="enveloppe">
${options.retour ? `<a class="retour" href="${escape(options.retour)}">← Retour</a>` : ""}
${corps}
</main>
</body>
</html>`;
}

export function message(ton: "ok" | "ko", texte: string): string {
  return `<p class="flash" data-ton="${ton}">${escape(texte)}</p>`;
}

/* -------------------------------------------------------------------------- */
/* Progression                                                                */
/* -------------------------------------------------------------------------- */

const RAYON = 40;
const TOUR = 2 * Math.PI * RAYON;

/**
 * L'anneau de progression, dessiné sur le serveur.
 *
 * `stroke-dasharray` porte la valeur : un trait long comme la part parcourue,
 * un vide long comme le tour entier. Aucun script, donc rien à attendre — et
 * la politique de sécurité de la console interdit de toute façon le script en
 * ligne.
 */
export function anneau(
  pourcentage: number,
  valeur: string,
  mot: string,
  etiquette: string,
): string {
  const part = Math.max(0, Math.min(100, pourcentage));
  return `<div class="anneau" role="img" aria-label="${escape(etiquette)}">
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle class="anneau__piste" cx="50" cy="50" r="${RAYON}"></circle>
    <circle class="anneau__part" cx="50" cy="50" r="${RAYON}"
            stroke-dasharray="${((part / 100) * TOUR).toFixed(1)} ${TOUR.toFixed(1)}"></circle>
  </svg>
  <div class="anneau__centre" aria-hidden="true">
    <span class="anneau__valeur">${escape(valeur)}</span>
    <span class="anneau__mot">${escape(mot)}</span>
  </div>
</div>`;
}

export function barreNiveau(niveau: Niveau, points: number): string {
  return `<div class="niveau">
  <div class="niveau__piste">
    <span class="niveau__part" style="width:${niveau.pourcentage}%"></span>
  </div>
  <div class="niveau__mots">
    <span>${points} point${points > 1 ? "s" : ""}</span>
    <span>${
      niveau.suivant
        ? `${niveau.restant} avant « ${escape(niveau.suivant.nom)} »`
        : "Dernier palier atteint"
    }</span>
  </div>
</div>`;
}

export function friseSerie(jours: JourDeSemaine[], compte: number): string {
  const pastilles = jours
    .map(
      (j) => `<div class="frise__jour" data-actif="${j.actif ? "oui" : "non"}"
       data-aujourdhui="${j.aujourdhui ? "oui" : "non"}">
    <span class="frise__pastille" aria-hidden="true">${j.actif ? "🔥" : ""}</span>
    <span>${escape(j.initiale)}</span>
  </div>`,
    )
    .join("");

  return `<div class="serie">
  <span class="serie__compte">
    <b>${compte}</b><span>jour${compte > 1 ? "s" : ""}</span>
  </span>
  <span class="serie__mot">${
    compte === 0
      ? "Rendez un exercice pour lancer votre série."
      : compte === 1
        ? "d'affilée. Revenez demain pour la tenir."
        : "d'affilée. Ne la cassez pas."
  }</span>
  <div class="frise" role="img"
       aria-label="Sept derniers jours : ${jours.filter((j) => j.actif).length} travaillé(s)">
    ${pastilles}
  </div>
</div>`;
}

/**
 * Le tableau de bord de l'élève : l'anneau, le niveau, la série.
 *
 * L'anneau porte l'avancement dans le programme et non les points : c'est la
 * question que se pose l'élève en ouvrant — « combien il m'en reste ? » — et
 * un pourcentage de points n'aurait aucun sens, le total n'étant pas borné.
 */
export function tableauDeBord(options: {
  avancement: Avancement;
  niveau: Niveau;
  points: number;
  serie: number;
  semaine: JourDeSemaine[];
}): string {
  const { avancement: a, niveau, points, serie, semaine } = options;
  return `<section class="tableau">
  <div class="tableau__haut">
    ${anneau(
      a.pourcentage,
      `${a.rendus}/${a.total}`,
      "rendus",
      `${a.rendus} exercice(s) rendu(s) sur ${a.total}`,
    )}
    <div class="tableau__texte">
      <div class="tableau__niveau">${escape(niveau.nom)}<span class="tableau__rang">Niveau ${niveau.rang}</span></div>
      <div class="tableau__points">${
        niveau.suivant
          ? `Encore ${niveau.restant} point${niveau.restant > 1 ? "s" : ""} pour « ${escape(
              niveau.suivant.nom,
            )} »`
          : "Vous avez atteint le dernier palier."
      }</div>
      ${barreNiveau(niveau, points)}
    </div>
  </div>
  ${friseSerie(semaine, serie)}
</section>`;
}

/* -------------------------------------------------------------------------- */
/* Hauts faits                                                                */
/* -------------------------------------------------------------------------- */

export function grilleHautsFaits(faits: HautFait[]): string {
  return `<div class="faits">${faits
    .map(
      (h) => `<div class="fait" data-obtenu="${h.obtenu ? "oui" : "non"}"
     title="${escape(h.phrase)}">
  <span class="fait__jeton" aria-hidden="true">${h.emoji}</span>
  <span class="fait__nom">${escape(h.nom)}</span>
  <span class="fait__compte">${
    h.obtenu ? "Obtenu" : h.requis > 0 ? `${h.fait} / ${h.requis}` : "—"
  }</span>
</div>`,
    )
    .join("")}</div>`;
}

/* -------------------------------------------------------------------------- */
/* Listes                                                                     */
/* -------------------------------------------------------------------------- */

/** L'état d'un exercice, en un mot et une couleur. */
export function puceEtat(etat: EtatTravail): string {
  return `<span class="puce" data-etat="${etat}">${escape(MOT_ETAT[etat])}</span>`;
}

export function puce(texte: string, ton?: string): string {
  return `<span class="puce"${ton ? ` data-ton="${ton}"` : ""}>${escape(texte)}</span>`;
}

const ICONE_ETAT: Record<EtatTravail, string> = {
  "a-faire": "○",
  commence: "✏️",
  rendu: "📨",
  acquis: "✅",
  "a-revoir": "🔁",
};

export function carteExercice(options: {
  href: string;
  titre: string;
  etat: EtatTravail;
  puces?: string[];
  retard?: boolean;
}): string {
  return `<a class="exo" href="${escape(options.href)}"
   data-etat="${options.etat}" data-retard="${options.retard ? "oui" : "non"}">
  <span class="exo__icone" aria-hidden="true">${ICONE_ETAT[options.etat]}</span>
  <span class="exo__texte">
    <span class="exo__titre">${escape(options.titre)}</span>
    ${
      options.puces && options.puces.length > 0
        ? `<span class="exo__sous">${options.puces.join("")}</span>`
        : ""
    }
  </span>
  <span class="exo__fleche" aria-hidden="true">›</span>
</a>`;
}

export function carte(options: {
  href: string;
  icone: string;
  titre: string;
  sous: string;
  compte?: number;
}): string {
  return `<a href="${escape(options.href)}">
  <span class="menu__icone" aria-hidden="true">${options.icone}</span>
  <span class="menu__texte">
    <b>${escape(options.titre)}</b>
    <span>${escape(options.sous)}</span>
  </span>
  ${options.compte ? `<span class="menu__compte">${options.compte}</span>` : ""}
</a>`;
}

export function tuile(options: {
  valeur: number | string;
  libelle: string;
  href?: string;
  ton?: "alerte";
}): string {
  const corps = `<b>${escape(String(options.valeur))}</b><span>${escape(options.libelle)}</span>`;
  const attrs = `class="tuile"${options.ton ? ` data-ton="${options.ton}"` : ""}`;
  return options.href
    ? `<a ${attrs} href="${escape(options.href)}">${corps}</a>`
    : `<div ${attrs}>${corps}</div>`;
}

export interface LigneClassement {
  id: string;
  nom: string;
  points: number;
  niveau: string;
  moi: boolean;
}

/**
 * Le classement de la classe.
 *
 * Les prénoms seuls, et le nom réduit à son initiale : une classe se reconnaît
 * entre elle sans qu'une liste de noms complets circule hors de l'école. Les
 * ex æquo partagent leur place — être treizième derrière trois personnes à
 * égalité serait une invention du logiciel.
 */
export function classement(lignes: LigneClassement[]): string {
  let place = 0;
  let precedent: number | null = null;

  return `<div class="rangs">${lignes
    .map((l, index) => {
      if (precedent === null || l.points !== precedent) place = index + 1;
      precedent = l.points;

      return `<div class="rang" data-place="${place}" data-moi="${l.moi ? "oui" : "non"}">
  <span class="rang__place">${place}</span>
  <span class="rang__texte" style="min-width:0">
    <span class="rang__nom">${escape(l.nom)}${l.moi ? " (vous)" : ""}</span><br>
    <span class="rang__niveau">${escape(l.niveau)}</span>
  </span>
  <span class="rang__points">${l.points}</span>
</div>`;
    })
    .join("")}</div>`;
}

/** Le texte tapé par quelqu'un, rendu tel qu'il l'a écrit. */
export function copie(texte: string, de: "eleve" | "professeur" = "eleve"): string {
  return `<p class="copie" data-de="${de}">${escape(texte)}</p>`;
}

/**
 * « il y a trois jours », pour une date qui peut manquer.
 *
 * L'heure exacte d'un travail rendu n'apprend rien ; ce qui compte est de
 * savoir si l'élève a travaillé cette semaine ou il y a un mois.
 */
export function depuisLisible(date: Date | null): string {
  if (!date) return "jamais";
  return depuis(date);
}

function depuis(date: Date): string {
  const jours = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 31) return `il y a ${jours} jours`;
  return `le ${dateLisible(date)}`;
}

/** « lundi 3 mars », sans l'année quand c'est cette année. */
export function dateLisible(valeur: string | Date): string {
  const date = valeur instanceof Date ? valeur : new Date(`${valeur}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(valeur);
  const memeAnnee = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(memeAnnee ? {} : { year: "numeric" }),
  });
}

/** L'échéance d'un devoir, dite du point de vue de celui qui la lit. */
export function puceEcheance(du_le: Date | null, retard: boolean): string {
  if (!du_le) return `<span class="puce">Sans date</span>`;
  return `<span class="puce" ${retard ? 'data-ton="retard"' : ""}>${
    retard ? "En retard depuis le " : "Pour le "
  }${escape(dateLisible(du_le))}</span>`;
}
