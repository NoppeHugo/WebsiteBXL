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
`;

export function layout(
  title: string,
  body: string,
  options: { authenticated?: boolean } = {},
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
