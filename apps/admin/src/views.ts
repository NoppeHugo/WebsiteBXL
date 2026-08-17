/**
 * Rendu HTML côté serveur, sans framework d'interface.
 *
 * La console est un outil interne pour une seule personne : une application
 * monopage y ajouterait un build, des dépendances et une surface de
 * maintenance, pour une valeur nulle. Des pages HTML et des formulaires
 * suffisent, et fonctionnent même depuis un téléphone en déplacement.
 */

export function escape(value: unknown): string {
  return String(value ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

const STYLE = `
:root {
  --bg: #000; --surface: #1d1d1f; --text: #f5f5f7; --muted: #86868b;
  --accent: #0071e3; --border: #2c2c2e; --danger: #ff453a; --ok: #30d158;
  color-scheme: dark;
}
* { box-sizing: border-box; margin: 0; }
body {
  background: var(--bg); color: var(--text);
  font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 0 0 4rem;
}
a { color: var(--accent); }
header {
  position: sticky; top: 0; z-index: 10;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--border);
  padding: 1rem 1.5rem; display: flex; gap: 1.5rem; align-items: center;
}
header strong { font-weight: 600; letter-spacing: -0.02em; }
header nav { margin-left: auto; display: flex; gap: 1.25rem; font-size: 0.9rem; }
main { max-width: 60rem; margin: 2rem auto; padding: 0 1.5rem; }
h1 { font-size: 1.9rem; letter-spacing: -0.03em; font-weight: 600; margin-bottom: 1.5rem; }
h2 { font-size: 1.2rem; font-weight: 600; margin: 2rem 0 0.75rem; letter-spacing: -0.02em; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.7rem 0.6rem; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 400; font-size: 0.85rem; }
label { display: grid; gap: 0.3rem; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.9rem; }
input, select, textarea {
  font: inherit; color: var(--text); background: var(--surface);
  border: 1px solid var(--border); border-radius: 10px; padding: 0.6em 0.8em; width: 100%;
}
textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; }
button {
  font: inherit; cursor: pointer; border: 1px solid transparent; border-radius: 980px;
  padding: 0.6em 1.4em; background: var(--accent); color: #fff;
}
button.secondary { background: transparent; border-color: var(--border); color: var(--text); }
button.danger { background: var(--danger); color: #fff; }
.row { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0 1rem; }
.actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
.badge {
  font-size: 0.75rem; padding: 0.2em 0.7em; border-radius: 980px;
  border: 1px solid var(--border); color: var(--muted);
}
.badge[data-status="live"] { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 40%, transparent); }
.badge[data-status="suspended"] { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 40%, transparent); }
.flash { padding: 0.9rem 1.1rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1.5rem; }
.flash[data-kind="error"] { border-color: color-mix(in srgb, var(--danger) 50%, transparent); }
.flash[data-kind="ok"] { border-color: color-mix(in srgb, var(--ok) 50%, transparent); }
pre { background: var(--surface); padding: 1rem; border-radius: 12px; overflow-x: auto; font-size: 0.8rem; }
.muted { color: var(--muted); font-size: 0.85rem; }
fieldset { border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.2rem; margin-bottom: 1.5rem; }
.media-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 1rem; margin-bottom: 1.5rem;
}
.media { margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.media img {
  width: 100%; aspect-ratio: 4 / 3; object-fit: cover;
  border-radius: 10px; border: 1px solid var(--border); background: var(--surface);
}
.media figcaption { display: flex; flex-direction: column; font-size: 0.75rem; word-break: break-all; }
.media button { padding: 0.35em 0.9em; font-size: 0.8rem; }
.filters { display: flex; gap: 1.25rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.filters label { margin: 0; }
.filters select { min-width: 12rem; }
.tiles {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 1px; background: var(--border); border: 1px solid var(--border);
  border-radius: 12px; overflow: hidden; margin-bottom: 1.5rem;
}
.tile { background: var(--surface); padding: 1rem; display: flex; flex-direction: column; gap: 0.15rem; }
.tile b { font-size: 1.7rem; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.tile span { font-size: 0.78rem; color: var(--muted); }
input[type="file"] { padding: 0.5em; background: var(--surface); }
legend { color: var(--muted); font-size: 0.85rem; padding: 0 0.4rem; }

/* --- Repères de lecture ------------------------------------------------ */

/* Chaque page dit ce qu'elle permet de faire. Un intitulé seul oblige à
   ouvrir pour savoir, et c'est ce qui rendait la console opaque. */
.intro { color: var(--muted); margin: -0.9rem 0 1.8rem; max-width: 46rem; }

/* L'état de publication, en tête de fiche : c'est la première question que
   se pose quiconque ouvre un client. */
.etat {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  padding: 1rem 1.2rem; border-radius: 14px; margin-bottom: 1.8rem;
  border: 1px solid var(--border); background: var(--surface);
}
.etat[data-etat="attente"] { border-color: color-mix(in srgb, #ff9f0a 55%, transparent); }
.etat[data-etat="enligne"] { border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
.etat__texte { flex: 1 1 16rem; }
.etat__texte b { display: block; font-size: 1.02rem; margin-bottom: 0.15rem; }
.etat__texte span { color: var(--muted); font-size: 0.85rem; }
.etat form { margin: 0; }

/* Liste des clients : une carte porte plus qu'une ligne de tableau, et se
   manipule au pouce sur un téléphone. */
.cartes { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); }
.carte {
  display: block; padding: 1.2rem 1.3rem; border-radius: 14px;
  border: 1px solid var(--border); background: var(--surface);
  text-decoration: none; color: inherit; transition: border-color 0.2s;
}
.carte:hover { border-color: color-mix(in srgb, var(--text) 30%, transparent); }
.carte__titre { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem; }
.carte__titre b { font-size: 1.05rem; letter-spacing: -0.01em; }
.carte__ligne { color: var(--muted); font-size: 0.85rem; }
.carte__pied { margin-top: 0.9rem; font-size: 0.8rem; color: var(--muted); }

/* Aide contextuelle : la phrase qui évite d'avoir à deviner un format. */
.aide { color: var(--muted); font-size: 0.82rem; margin-top: 0.35rem; }

/* Ce qui peut casser le site est replié : accessible, mais pas sur le chemin
   de quelqu'un qui vient corriger un horaire. */
details.avance { border: 1px solid var(--border); border-radius: 14px; margin-top: 2rem; }
details.avance > summary {
  cursor: pointer; padding: 1rem 1.2rem; font-weight: 600; list-style: none;
}
details.avance > summary::-webkit-details-marker { display: none; }
details.avance > summary::before { content: "▸ "; color: var(--muted); }
details.avance[open] > summary::before { content: "▾ "; }
details.avance > div { padding: 0 1.2rem 1.2rem; }

/* Une photo dit à quoi elle sert, et si elle est verrouillée. */
.media__usage {
  font-size: 0.72rem; color: var(--muted);
  border: 1px solid var(--border); border-radius: 980px;
  padding: 0.1em 0.6em; align-self: flex-start;
}
.media__usage[data-usage="libre"] { opacity: 0.6; }
.lien-site { font-size: 0.85rem; }

/* --- Éditeur de contenu ------------------------------------------------- */

.bloc { border: 1px solid var(--border); border-radius: 16px; padding: 1.4rem 1.5rem; margin-bottom: 1.5rem; }
.bloc__tete { margin-bottom: 1.4rem; }
.bloc__tete h2 { margin: 0 0 0.3rem; }
.bloc__tete .aide { margin: 0; }

.champ { margin-bottom: 1.2rem; }
.champ__libelle { display: block; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.35rem; }

/*
 * Onglets de langue, en CSS seul : trois boutons radio masqués, et la zone
 * correspondante affichée par le sélecteur de rang. Aucun script, donc rien à
 * réparer si le JavaScript ne charge pas.
 */
.onglets { position: relative; }
.onglet__radio { position: absolute; opacity: 0; pointer-events: none; }
.onglet__nom {
  display: inline-block; margin: 0 0.3rem 0.5rem 0; padding: 0.25em 0.85em;
  font-size: 0.8rem; border-radius: 980px; border: 1px solid var(--border);
  color: var(--muted); cursor: pointer;
}
/* Une pastille signale les langues déjà remplies : sans elle, il faut ouvrir
   les trois onglets pour savoir laquelle manque. */
.onglet__nom[data-rempli="true"]::after {
  content: "•"; margin-left: 0.4em; color: var(--ok);
}
.onglet__radio:checked + .onglet__nom {
  color: var(--text); border-color: color-mix(in srgb, var(--text) 45%, transparent);
  background: var(--surface);
}
.onglet__radio:focus-visible + .onglet__nom { outline: 2px solid var(--accent); outline-offset: 2px; }
.onglets__zones > .onglet__zone { display: none; }
.onglets:has(.onglet__radio:nth-of-type(1):checked) .onglet__zone:nth-child(1),
.onglets:has(.onglet__radio:nth-of-type(2):checked) .onglet__zone:nth-child(2),
.onglets:has(.onglet__radio:nth-of-type(3):checked) .onglet__zone:nth-child(3) { display: block; }
.onglets textarea { font-family: inherit; font-size: 1rem; }

/* Emplacement de photo. */
.photo { margin-bottom: 1.2rem; }
.photo__zone {
  display: flex; align-items: center; justify-content: center; position: relative;
  min-height: 9rem; padding: 0.8rem; margin: 0; cursor: pointer;
  border: 1px dashed color-mix(in srgb, var(--muted) 55%, transparent);
  border-radius: 14px; background: var(--surface); text-align: center;
  transition: border-color 0.15s, background-color 0.15s;
}
.photo__zone:hover { border-color: var(--muted); }
.photo__zone[data-survol="true"] {
  border-color: var(--accent); border-style: solid;
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
.photo__zone img { max-height: 13rem; border-radius: 10px; object-fit: contain; }
.photo__invite { color: var(--muted); font-size: 0.85rem; max-width: 16rem; }
.photo__etat { position: absolute; inset-inline: 0.5rem; bottom: 0.5rem; font-size: 0.75rem; color: var(--muted); }
.photo__retirer { margin-top: 0.5rem; padding: 0.3em 1em; font-size: 0.8rem; }
.photo[data-occupe="true"] .photo__zone { opacity: 0.6; }

/* Listes réordonnables. */
.liste { list-style: none; padding: 0; margin: 0 0 1rem; display: grid; gap: 1rem; }
.element { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
.element[data-saisi="true"] { opacity: 0.4; border-style: dashed; }
.element__barre {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.7rem 1rem; border-bottom: 1px solid var(--border);
}
.element__poignee { cursor: grab; color: var(--muted); user-select: none; font-size: 1.1rem; }
.element__poignee:active { cursor: grabbing; }
.element__titre { flex: 1; font-size: 0.95rem; }
.element__ordre { display: flex; gap: 0.35rem; }
.element__ordre button { padding: 0.2em 0.7em; font-size: 0.85rem; }
.element__corps { padding: 1.1rem 1rem 0.4rem; }
.element__corps--deux { display: grid; gap: 1.2rem; }
@media (min-width: 46rem) {
  .element__corps--deux { grid-template-columns: 16rem 1fr; }
}

/* Sommaire des sections, collant : la page est longue, et sauter d'un bout à
   l'autre en la parcourant est le geste le plus fréquent. */
.sommaire {
  position: sticky; top: 4.2rem; z-index: 5; display: flex; flex-wrap: wrap; gap: 0.4rem;
  padding: 0.7rem 0; margin-bottom: 1.5rem;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
}
.sommaire a {
  font-size: 0.82rem; text-decoration: none; color: var(--muted);
  border: 1px solid var(--border); border-radius: 980px; padding: 0.25em 0.85em;
}
.sommaire a:hover { color: var(--text); border-color: var(--muted); }

/* Le chemin principal depuis la fiche client vers l'éditeur : c'est le geste
   le plus fréquent, il ne doit pas se chercher. */
.raccourci { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.8rem; }
.raccourci .aide { margin: 0; }
.btn-lien {
  display: inline-block; text-decoration: none; background: var(--accent); color: #fff;
  border-radius: 980px; padding: 0.6em 1.4em; font-size: 0.95rem;
}
.btn-lien:hover { filter: brightness(1.12); }
.btn-lien--second { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn-lien--second:hover { border-color: var(--muted); filter: none; }

/* --- Choix de l'apparence ----------------------------------------------- */

/*
 * Chaque style est montré, jamais décrit seul : un commerçant reconnaît une
 * mise en page d'un coup d'œil, et ne devinera pas ce que recouvre
 * « typographie condensée ». Les vignettes sont rendues avec les vraies
 * polices et les vraies couleurs — elles suivent donc toute modification d'un
 * style, sans capture à régénérer.
 */
.choix-grille {
  display: grid; gap: 1rem; margin-bottom: 2.5rem;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
}
.choix {
  display: grid; gap: 0.9rem; margin: 0; cursor: pointer;
  border: 1px solid var(--border); border-radius: 14px; padding: 1rem;
  transition: border-color 0.15s;
}
.choix:hover { border-color: var(--muted); }
/*
 * Le choix retenu est cerné franchement, pas souligné d'un cheveu : cette page
 * s'ouvre d'abord pour savoir ce qui est appliqué, et seulement ensuite pour en
 * changer. Un liseré d'un pixel ne répond pas à la première question.
 */
.choix:has(input:checked) {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}
.choix.est-actif { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok); }
/* Une fois qu'on a cliqué ailleurs, c'est la nouvelle sélection qui prime :
   l'ancienne n'est plus qu'un souvenir, et deux cadres se disputeraient l'œil. */
.choix.est-actif:not(:has(input:checked)) { border-color: var(--border); box-shadow: none; }

.marque {
  font-size: 0.68rem; font-weight: 400; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--ok);
  border: 1px solid color-mix(in srgb, var(--ok) 45%, transparent);
  border-radius: 980px; padding: 0.1em 0.6em; margin-left: 0.5rem;
  vertical-align: 0.1em;
}
.choix input { position: absolute; opacity: 0; pointer-events: none; }
.choix__texte { display: grid; gap: 0.2rem; font-size: 0.85rem; }
.choix__texte b { font-size: 0.95rem; color: var(--text); }
.choix__texte span { color: var(--muted); }

.vignette {
  display: grid; gap: 0.55rem; justify-items: start;
  padding: 1rem; border: 1px solid; border-radius: 10px; min-height: 7.5rem;
}
.vignette__titre { font-size: 2rem; line-height: 1; }
.vignette__filet { display: block; width: 100%; height: 1px; }
.vignette__btn { font-size: 0.68rem; padding: 0.45em 1.1em; }

.teinte-grille {
  display: grid; gap: 0.75rem; margin-bottom: 2rem;
  grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
}
.teinte {
  display: grid; gap: 0.5rem; margin: 0; cursor: pointer; text-align: center;
  border: 1px solid var(--border); border-radius: 12px; padding: 0.75rem;
  font-size: 0.85rem; color: var(--text);
}
.teinte:has(input:checked) {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}
.teinte.est-actif { border-color: var(--ok); box-shadow: 0 0 0 2px var(--ok); }
.teinte.est-actif:not(:has(input:checked)) { border-color: var(--border); box-shadow: none; }
.teinte b { display: block; }
.teinte input { position: absolute; opacity: 0; pointer-events: none; }
.teinte__pastilles { display: flex; height: 2.2rem; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.teinte__pastilles span { flex: 1; }
`;

export function layout(
  title: string,
  body: string,
  options: { authenticated?: boolean; editeur?: boolean } = {},
): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escape(title)} — Console</title>
<style>${STYLE}</style>
</head>
<body>
${
  options.authenticated
    ? `<header>
  <strong>WebsiteBXL</strong>
  <nav>
    <a href="/">Clients</a>
    <a href="/agenda">Agenda</a>
    <a href="/requests">Demandes</a>
    <a href="/reports">Rapports</a>
    <a href="/billing">Abonnements</a>
    <form method="post" action="/logout" style="display:inline">
      <button class="secondary" style="padding:0.3em 1em;font-size:0.85rem">Quitter</button>
    </form>
  </nav>
</header>`
    : ""
}
<main>${body}</main>
${
  // `defer` plutôt qu'un script en tête : l'éditeur ne se branche qu'une fois
  // la page construite, et son absence ne retarde jamais l'affichage.
  options.editeur ? `<script src="/assets/editeur.js" defer></script>` : ""
}
</body>
</html>`;
}

export function flash(kind: "ok" | "error", message: string): string {
  return `<p class="flash" data-kind="${kind}">${escape(message)}</p>`;
}

/**
 * Les statuts sont stockés en anglais dans `site.json` — c'est un format de
 * données, il n'a pas à changer. Mais « draft » affiché tel quel dans une
 * console française oblige à connaître la convention interne pour se servir de
 * l'outil.
 */
export const STATUTS = {
  draft: {
    nom: "Brouillon",
    aide: "En préparation. Le site n'est pas accessible au public.",
  },
  live: {
    nom: "En ligne",
    aide: "Visible de tous, à l'adresse du commerce.",
  },
  suspended: {
    nom: "Suspendu",
    aide: "Remplacé par une page d'indisponibilité. Rien n'est supprimé, le retour en ligne est immédiat.",
  },
} as const;

export function statutLisible(statut: string): string {
  return STATUTS[statut as keyof typeof STATUTS]?.nom ?? statut;
}

/** « il y a 3 minutes », « hier », « le 4 mars ». */
export function depuis(date: Date | null): string {
  if (!date) return "jamais";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  if (jours === 1) return "hier";
  if (jours < 7) return `il y a ${jours} jours`;
  return `le ${date.toLocaleDateString("fr-BE", { day: "numeric", month: "long" })}`;
}
