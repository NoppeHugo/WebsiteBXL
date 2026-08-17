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
  photos: { titre: "Mes photos", sous: "Les images du salon", icone: "📷" },
  presentation: { titre: "Mon texte", sous: "Ce qui est écrit sur le salon", icone: "✍️" },
  "rendez-vous": { titre: "Mes rendez-vous", sous: "Ce qui est réservé", icone: "📅" },
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
.vide {
  text-align: center; color: var(--doux); padding: 2.5rem 1rem;
  background: var(--carte); border: 1px dashed var(--bord); border-radius: 14px;
}

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
${options.script ? `<script src="/assets/espace.js" defer></script>` : ""}
</body>
</html>`;
}

export function message(ton: "ok" | "ko", texte: string): string {
  return `<p class="flash" data-ton="${ton}">${escape(texte)}</p>`;
}

/** « lundi 3 mars », sans l'année quand c'est cette année. */
export function dateLisible(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
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
