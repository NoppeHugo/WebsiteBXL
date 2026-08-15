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
input[type="file"] { padding: 0.5em; background: var(--surface); }
legend { color: var(--muted); font-size: 0.85rem; padding: 0 0.4rem; }
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
    <a href="/requests">Demandes</a>
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
