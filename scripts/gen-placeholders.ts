import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { metierDe } from "../packages/schema/src/metiers.ts";
import { repoRoot, info, ok, fail } from "./lib.ts";

/**
 * Génère des visuels de remplacement.
 *
 * Ils existent pour une seule raison : un nouveau client doit se construire et
 * s'afficher correctement avant la séance photo, pour pouvoir être montré au
 * commerçant. Ils sont volontairement abstraits — jamais une photo trouvée
 * ailleurs, qui poserait un problème de droits et se verrait immédiatement.
 *
 * Un dégradé nu remplit cette fonction, mais il ne dit rien du métier : sur un
 * téléphone, en clientèle, trois rectangles bruns sous le titre « Notre
 * équipe » se lisent comme un site inachevé. Chaque visuel porte donc un motif
 * dessiné ici même — silhouette, ciseaux, peigne, fût de barbier.
 *
 * Aucun de ces motifs ne représente une personne identifiable, et c'est
 * délibéré. Une photographie de stock, même sous licence permissive, ne
 * transporte pas l'autorisation de la personne photographiée : présenter un
 * inconnu comme employé d'un commerce l'expose, et expose l'exploitant.
 */

export type Motif =
  | "silhouette"
  | "ciseaux"
  | "peigne"
  | "fut"
  | "blaireau"
  | "rayures"
  /* --- fleuriste --- */
  | "fleur"
  | "feuillage"
  | "vase"
  | "bouquet"
  | "ruban"
  | "graine"
  | "aucun";

export interface PlaceholderSpec {
  file: string;
  width: number;
  height: number;
  /** Teinte en degrés, pour varier les images d'une même galerie. */
  hue: number;
  /** Motif dessiné par-dessus le dégradé. Absent : dégradé seul. */
  motif?: Motif;
}

/**
 * Le motif, en clair très peu opaque : il doit se deviner, pas s'imposer.
 * Un remplacement qui attire l'œil plus que le contenu fausse le jugement sur
 * la mise en page — et c'est pour juger la mise en page qu'il existe.
 */
function dessin(motif: Motif, w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  // Toutes les formes sont dimensionnées sur la plus petite dimension : le
  // même motif tient dans un portrait vertical comme dans un hero panoramique.
  const u = Math.min(w, h);
  const trait = Math.max(2, u * 0.012);
  const encre = `stroke="#fff" stroke-opacity="0.16" fill="none" stroke-width="${trait}" stroke-linecap="round" stroke-linejoin="round"`;

  switch (motif) {
    /*
     * Buste de trois quarts, sans un seul trait de visage. La forme suffit à
     * faire lire « portrait » à l'emplacement d'un portrait ; y ajouter des
     * yeux donnerait un personnage, donc une identité, donc une question.
     */
    case "silhouette": {
      const tete = u * 0.16;
      const centreTete = cy - u * 0.12;
      // Les épaules montent jusqu'à mordre légèrement sur le bas de la tête :
      // un intervalle, même de quelques pixels, détache le cercle du buste et
      // le résultat cesse d'être un portrait pour devenir une icône.
      const sommetEpaules = centreTete + tete * 0.88;
      // Les épaules débordent volontairement du cadre : seule la portion
      // centrale de l'arc reste visible, et c'est elle qui se lit comme une
      // carrure. Un arc contenu dans la largeur donnerait un ovale, pas un
      // buste — c'est le cadrage serré qui fait le portrait.
      const largeur = u * 0.62;
      const hauteurBuste = h - sommetEpaules;
      // L'opacité porte sur le groupe, pas sur chaque forme : appliquée forme
      // par forme, elle s'additionnerait là où la tête recouvre les épaules et
      // dessinerait un croissant clair à la jonction.
      return `
  <g fill="#fff" opacity="0.12">
    <circle cx="${cx}" cy="${centreTete}" r="${tete}"/>
    <path d="M ${cx - largeur} ${h}
             a ${largeur} ${hauteurBuste} 0 0 1 ${largeur * 2} 0 Z"/>
  </g>`;
    }

    case "ciseaux": {
      const r = u * 0.07;
      const bas = cy + u * 0.2;
      const haut = cy - u * 0.22;
      // Les deux lames étant symétriques, elles se croisent à mi-hauteur de
      // leur trajet. Poser le rivet à l'estime le décale visiblement du
      // croisement, et l'objet cesse d'être un outil articulé.
      const rivet = (bas - r + haut) / 2;
      return `
  <g ${encre}>
    <circle cx="${cx - u * 0.12}" cy="${bas}" r="${r}"/>
    <circle cx="${cx + u * 0.12}" cy="${bas}" r="${r}"/>
    <line x1="${cx - u * 0.12}" y1="${bas - r}" x2="${cx + u * 0.1}" y2="${haut}"/>
    <line x1="${cx + u * 0.12}" y1="${bas - r}" x2="${cx - u * 0.1}" y2="${haut}"/>
    <circle cx="${cx}" cy="${rivet}" r="${trait * 0.9}" fill="#fff" fill-opacity="0.16"/>
  </g>`;
    }

    case "peigne": {
      const l = u * 0.46;
      const dos = cy - u * 0.06;
      const dents = 13;
      const pas = l / (dents - 1);
      const traits = Array.from({ length: dents }, (_, i) => {
        const x = cx - l / 2 + i * pas;
        return `<line x1="${x}" y1="${dos}" x2="${x}" y2="${dos + u * 0.17}"/>`;
      }).join("\n    ");
      return `
  <g ${encre}>
    <line x1="${cx - l / 2}" y1="${dos}" x2="${cx + l / 2}" y2="${dos}"/>
    ${traits}
  </g>`;
    }

    /*
     * Fût de barbier. Un coupe-choux avait été tenté d'abord : en trait fin et
     * à cette opacité, sa lame et son manche se lisaient comme deux barres
     * sans rapport. Le fût, lui, tient dans une silhouette unique que tout le
     * monde reconnaît, et c'est bien l'enseigne du métier.
     */
    case "fut": {
      const larg = u * 0.15;
      const haut = u * 0.4;
      const x = cx - larg / 2;
      const y = cy - haut / 2;
      const embout = larg * 1.32;
      const pas = larg * 0.3;
      // Les rayures dépassent du corps et sont rognées par lui : les calculer
      // pour qu'elles s'arrêtent pile aux bords donnerait des extrémités
      // biseautées, jamais tout à fait justes.
      const rayures = Array.from(
        { length: Math.ceil((larg + haut) / pas) },
        (_, i) =>
          `<line x1="${x - larg + i * pas}" y1="${y + haut + larg}" x2="${x - larg + i * pas + larg * 2}" y2="${y - larg}"/>`,
      ).join("\n      ");
      return `
  <defs>
    <clipPath id="fut">
      <rect x="${x}" y="${y}" width="${larg}" height="${haut}" rx="${larg / 2}"/>
    </clipPath>
  </defs>
  <g ${encre}>
    <rect x="${x}" y="${y}" width="${larg}" height="${haut}" rx="${larg / 2}"/>
    <g clip-path="url(#fut)" stroke-width="${trait * 0.8}">
      ${rayures}
    </g>
    <rect x="${cx - embout / 2}" y="${y - larg * 0.42}" width="${embout}" height="${larg * 0.34}" rx="${larg * 0.12}"/>
    <rect x="${cx - embout / 2}" y="${y + haut + larg * 0.08}" width="${embout}" height="${larg * 0.34}" rx="${larg * 0.12}"/>
  </g>`;
    }

    case "blaireau": {
      const larg = u * 0.16;
      return `
  <g ${encre}>
    <path d="M ${cx - larg} ${cy}
             a ${larg} ${u * 0.13} 0 0 1 ${larg * 2} 0 Z"/>
    <path d="M ${cx - larg * 0.72} ${cy}
             l ${larg * 0.2} ${u * 0.24}
             l ${larg * 0.84} 0
             l ${larg * 0.2} ${-u * 0.24} Z"/>
  </g>`;
    }

    /* Rappel du fût de barbier, couché et très étiré : lisible en fond de
       hero, où un objet centré entrerait en concurrence avec le titre. */
    /*
     * Une corolle à six pétales, vue de face. Six et non cinq : un nombre
     * impair de pétales place une pointe en haut et donne une étoile, pas une
     * fleur. Le disque central est ce qui fait basculer la lecture — sans lui,
     * les mêmes ellipses se lisent comme une hélice.
     */
    case "fleur": {
      const r = u * 0.19;
      const petale = r * 0.62;
      const petales = Array.from({ length: 6 }, (_, i) => {
        const angle = (i * Math.PI) / 3;
        const px = cx + Math.cos(angle) * r * 0.72;
        const py = cy + Math.sin(angle) * r * 0.72;
        const deg = (angle * 180) / Math.PI;
        return `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${petale.toFixed(1)}" ry="${(petale * 0.55).toFixed(1)}" transform="rotate(${deg.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
      }).join("\n    ");
      return `
  <g ${encre}>
    ${petales}
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.3).toFixed(1)}"/>
  </g>`;
    }

    /*
     * Une tige feuillue, penchée. L'inclinaison est ce qui distingue une
     * branche d'un épi de blé : la verticale parfaite est agricole, l'oblique
     * est botanique.
     */
    case "feuillage": {
      const bas = cy + u * 0.26;
      const haut = cy - u * 0.28;
      const feuilles = Array.from({ length: 5 }, (_, i) => {
        const t = (i + 1) / 6;
        const y = bas + (haut - bas) * t;
        const x = cx + (haut - bas) * t * 0.18;
        const cote = i % 2 === 0 ? 1 : -1;
        const l = u * 0.13 * (1 - t * 0.35);
        return `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} q ${(l * cote).toFixed(1)} ${(-l * 0.8).toFixed(1)} ${(l * 1.7 * cote).toFixed(1)} ${(-l * 0.15).toFixed(1)} q ${(-l * 0.7 * cote).toFixed(1)} ${(l * 0.9).toFixed(1)} ${(-l * 1.7 * cote).toFixed(1)} ${(l * 0.15).toFixed(1)} Z"/>`;
      }).join("\n    ");
      return `
  <g ${encre}>
    <path d="M ${cx} ${bas} Q ${cx + u * 0.05} ${cy} ${(cx + (haut - bas) * 0.18).toFixed(1)} ${haut}"/>
    ${feuilles}
  </g>`;
    }

    /*
     * Un vase à col resserré. Le col est l'essentiel : un simple trapèze se
     * lit comme un seau, et c'est l'étranglement qui dit « vase ».
     */
    case "vase": {
      const col = u * 0.1;
      const ventre = u * 0.19;
      const haut = cy - u * 0.2;
      const bas = cy + u * 0.24;
      const epaule = haut + (bas - haut) * 0.32;
      return `
  <g ${encre}>
    <path d="M ${cx - col} ${haut}
             L ${cx - col * 0.86} ${epaule}
             Q ${cx - ventre} ${bas - u * 0.06} ${cx - ventre * 0.62} ${bas}
             L ${cx + ventre * 0.62} ${bas}
             Q ${cx + ventre} ${bas - u * 0.06} ${cx + col * 0.86} ${epaule}
             L ${cx + col} ${haut} Z"/>
    <line x1="${cx - col}" y1="${haut}" x2="${cx + col}" y2="${haut}"/>
  </g>`;
    }

    /*
     * Trois tiges liées, s'ouvrant en éventail. Un bouquet se reconnaît à son
     * point de liage : sans le lien, trois tiges divergentes ne sont que trois
     * traits.
     */
    case "bouquet": {
      const lien = cy + u * 0.22;
      const tiges = [-1, 0, 1].map((cote) => {
        const sommet = cy - u * 0.24 + Math.abs(cote) * u * 0.05;
        const x = cx + cote * u * 0.17;
        return `<path d="M ${cx} ${lien} Q ${(cx + cote * u * 0.05).toFixed(1)} ${((lien + sommet) / 2).toFixed(1)} ${x.toFixed(1)} ${sommet.toFixed(1)}"/>
    <circle cx="${x.toFixed(1)}" cy="${sommet.toFixed(1)}" r="${(u * 0.055).toFixed(1)}"/>`;
      }).join("\n    ");
      return `
  <g ${encre}>
    ${tiges}
    <path d="M ${cx - u * 0.06} ${lien} h ${u * 0.12}"/>
    <path d="M ${cx} ${lien} v ${u * 0.1}"/>
  </g>`;
    }

    /*
     * Un ruban noué. Deux boucles et deux pans : retirer les pans donne un
     * nœud papillon, qui appartient à un autre commerce.
     */
    case "ruban": {
      const b = u * 0.14;
      return `
  <g ${encre}>
    <path d="M ${cx} ${cy} C ${cx - b * 1.9} ${cy - b * 1.5} ${cx - b * 2.1} ${cy + b * 0.9} ${cx} ${cy} Z"/>
    <path d="M ${cx} ${cy} C ${cx + b * 1.9} ${cy - b * 1.5} ${cx + b * 2.1} ${cy + b * 0.9} ${cx} ${cy} Z"/>
    <path d="M ${cx - b * 0.2} ${cy + b * 0.2} L ${cx - b * 0.9} ${cy + b * 2.2}"/>
    <path d="M ${cx + b * 0.2} ${cy + b * 0.2} L ${cx + b * 0.9} ${cy + b * 2.2}"/>
    <circle cx="${cx}" cy="${cy}" r="${(b * 0.22).toFixed(1)}"/>
  </g>`;
    }

    /*
     * Une graine germée. Le motif le plus discret des six : il sert aux
     * emplacements secondaires, où un bouquet entier attirerait trop l'œil.
     */
    case "graine": {
      const r = u * 0.09;
      const sol = cy + u * 0.12;
      return `
  <g ${encre}>
    <ellipse cx="${cx}" cy="${sol}" rx="${r}" ry="${(r * 1.3).toFixed(1)}"/>
    <path d="M ${cx} ${sol - r * 1.3} v ${(-u * 0.13).toFixed(1)}"/>
    <path d="M ${cx} ${(sol - r * 1.9).toFixed(1)} q ${(u * 0.1).toFixed(1)} ${(-u * 0.05).toFixed(1)} ${(u * 0.12).toFixed(1)} ${(u * 0.03).toFixed(1)} q ${(-u * 0.08).toFixed(1)} ${(u * 0.04).toFixed(1)} ${(-u * 0.12).toFixed(1)} ${(-u * 0.03).toFixed(1)} Z"/>
  </g>`;
    }

    case "rayures": {
      const pas = u * 0.14;
      const lignes = Math.ceil((w + h) / pas);
      return `
  <g stroke="#fff" stroke-opacity="0.05" stroke-width="${u * 0.045}">
    ${Array.from(
      { length: lignes },
      (_, i) =>
        `<line x1="${i * pas - h}" y1="${h}" x2="${i * pas}" y2="0"/>`,
    ).join("\n    ")}
  </g>`;
    }

    default:
      return "";
  }
}

function svg({ width, height, hue, motif = "aucun" }: PlaceholderSpec): string {
  // Assez clairs pour rester lisibles sur un thème sombre : un remplacement
  // invisible empêche de juger la mise en page avant la séance photo.
  const light = `hsl(${hue}, 14%, 44%)`;
  const dark = `hsl(${hue}, 18%, 13%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="v" cx="50%" cy="38%" r="72%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  ${dessin(motif, width, height)}
  <rect width="${width}" height="${height}" filter="url(#n)" opacity="0.06"/>
  <rect width="${width}" height="${height}" fill="url(#v)"/>
</svg>`;
}

export async function generatePlaceholders(
  mediaDir: string,
  specs: PlaceholderSpec[],
): Promise<void> {
  mkdirSync(mediaDir, { recursive: true });
  for (const spec of specs) {
    await sharp(Buffer.from(svg(spec)))
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(join(mediaDir, spec.file));
  }
}

/** Jeu standard : un hero, six photos de galerie, trois portraits. */
export function defaultSpecs(metierId = "soins"): PlaceholderSpec[] {
  /*
   * Les motifs suivent le métier. Un fût de barbier sur le site d'un fleuriste
   * ne serait pas seulement hors sujet : le commerçant à qui on le montre en
   * conclurait qu'on lui sert le site d'un autre, et il aurait raison.
   */
  const parMetier: Record<string, { hero: Motif; galerie: Motif[]; portrait: Motif }> = {
    soins: {
      hero: "rayures",
      galerie: ["ciseaux", "peigne", "fut", "blaireau", "ciseaux", "peigne"],
      portrait: "silhouette",
    },
    fleuriste: {
      hero: "feuillage",
      galerie: ["fleur", "bouquet", "vase", "feuillage", "ruban", "graine"],
      portrait: "silhouette",
    },
    commerce: {
      hero: "rayures",
      galerie: ["rayures", "rayures", "rayures", "rayures", "rayures", "rayures"],
      portrait: "silhouette",
    },
  };

  const motifs = parMetier[metierId] ?? parMetier.soins!;

  /*
   * Les teintes aussi : la gamme chaude et brune convient au bois et au cuir
   * d'un salon de barbier, et donne à un fleuriste des visuels couleur terre
   * cuite là où on attend du végétal.
   */
  const teinte = metierId === "fleuriste" ? 96 : 16;

  return [
    { file: "hero.jpg", width: 2400, height: 1600, hue: teinte + 8, motif: motifs.hero },
    ...Array.from({ length: 6 }, (_, i) => ({
      file: `galerie-${i + 1}.jpg`,
      width: 1400,
      height: 1750,
      hue: teinte + i * 6,
      motif: motifs.galerie[i]!,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      file: `equipe-${i + 1}.jpg`,
      width: 900,
      height: 1200,
      hue: teinte + 6 + i * 8,
      motif: motifs.portrait,
    })),
  ];
}

// Exécution directe : `pnpm placeholders <slug>`
if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = process.argv[2];
  if (!slug) fail("usage : pnpm placeholders <slug> [métier]");

  /*
   * Le métier est lu dans le `site.json` du client plutôt que passé en
   * argument : c'est le fichier qui fait foi, et un argument oublié aurait
   * produit des ciseaux chez un fleuriste sans que rien ne le signale.
   */
  let metierId = process.argv[3] ?? "";
  if (!metierId) {
    try {
      const brut = JSON.parse(
        readFileSync(join(repoRoot, "clients", slug, "site.json"), "utf8"),
      ) as { business?: { type?: string } };
      metierId = metierDe(brut.business?.type ?? "").id;
    } catch {
      metierId = "soins";
    }
  }

  const mediaDir = join(repoRoot, "clients", slug, "media");
  info(`génération des visuels de remplacement dans clients/${slug}/media (métier : ${metierId})`);
  await generatePlaceholders(mediaDir, defaultSpecs(metierId));
  ok("visuels générés — à remplacer par les vraies photos après la séance");
}
