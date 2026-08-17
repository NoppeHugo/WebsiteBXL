import { join } from "node:path";
import sharp from "sharp";

/**
 * Clair ou sombre : de quelle couleur doit être le texte posé sur une photo.
 *
 * Le calcul se fait à la construction du site, jamais dans le navigateur.
 * Analyser une image côté client demanderait de la redessiner dans un canvas —
 * du travail à chaque visite, pour un résultat qui ne change jamais entre deux
 * publications. Ici, la mesure est faite une fois et voyage dans le HTML.
 *
 * Elle ne porte pas sur l'image entière mais sur la bande où le texte se posera
 * réellement : une photo peut être claire en haut et sombre en bas, et c'est
 * seulement ce qu'il y a *sous les lettres* qui décide de leur lisibilité.
 */

export type Tonalite = "clair" | "sombre";

/*
 * Résolu depuis le répertoire de travail du build, et non depuis
 * `import.meta.url` : Astro compile ce module avant de l'exécuter, si bien que
 * l'URL du module désigne un fichier temporaire, pas la source. Le chemin
 * tombait donc à côté, l'erreur était avalée par le repli, et toutes les photos
 * étaient déclarées sombres — y compris les plus claires.
 */
const MEDIA = join(process.cwd(), "src", "media");

/** Cache : le même hero est analysé une fois par langue rendue. */
const cache = new Map<string, Tonalite>();

/**
 * Bande analysée selon l'endroit où le texte est ancré.
 *
 * Les proportions sont relatives : elles valent pour une image de n'importe
 * quelle taille.
 */
const ZONES: Record<string, { haut: number; hauteur: number }> = {
  // Texte ancré en bas : on regarde la moitié basse.
  start: { haut: 0.5, hauteur: 0.5 },
  // Texte centré : on regarde la bande médiane.
  center: { haut: 0.3, hauteur: 0.45 },
};

export async function tonalite(
  src: string,
  ancrage: string = "start",
): Promise<Tonalite> {
  const cle = `${src}|${ancrage}`;
  const connu = cache.get(cle);
  if (connu) return connu;

  const zone = ZONES[ancrage] ?? ZONES.start!;

  try {
    const image = sharp(join(MEDIA, src.replace(/^\.?\/*/, "")));
    const { width = 0, height = 0 } = await image.metadata();
    if (!width || !height) return "sombre";

    /*
     * `stats()` sur la bande découpée donne la moyenne par canal. La moyenne
     * suffit ici : on ne cherche pas la couleur dominante mais si l'ensemble
     * penche vers le clair ou le sombre.
     */
    const { channels } = await image
      .extract({
        left: 0,
        top: Math.floor(height * zone.haut),
        width,
        height: Math.max(1, Math.floor(height * zone.hauteur)),
      })
      .stats();

    const [r, g, b] = channels.map((c) => c.mean / 255);
    // Luminance perçue, telle que définie par WCAG : l'œil est bien plus
    // sensible au vert qu'au bleu, une moyenne brute se tromperait sur les
    // images très colorées.
    const canaux = [r!, g!, b!].map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    const luminance =
      0.2126 * canaux[0]! + 0.7152 * canaux[1]! + 0.0722 * canaux[2]!;

    /*
     * Seuil calculé, pas choisi à l'œil.
     *
     * La luminance relative n'est pas linéaire : un gris moyen vaut 0,21 et
     * non 0,5. Un premier seuil posé à 0,38 « au jugé » ne basculait jamais —
     * mesurées, les douze photos du salon s'étageaient de 0,05 à 0,33.
     *
     * Le bon point se déduit du contraste visé. Sur un fond de luminance L, un
     * texte noir tient 4,5:1 dès L > 0,207 ; un texte blanc, jusqu'à L < 0,183.
     * Entre les deux, aucune des deux couleurs n'atteint le seuil : on prend le
     * point d'équilibre, celui où les deux contrastes se valent.
     */
    const resultat: Tonalite = luminance > 0.19 ? "clair" : "sombre";
    cache.set(cle, resultat);
    return resultat;
  } catch (erreur) {
    /*
     * Une image illisible ne doit pas casser la construction du site : le texte
     * clair sur voile sombre est le cas le plus courant, et le plus sûr.
     *
     * Mais l'échec est dit. Muet, il se confond avec une photo réellement
     * sombre — c'est exactement ainsi qu'un mauvais chemin est passé inaperçu.
     */
    console.warn(
      `tonalité : « ${src} » n'a pas pu être analysée (${
        erreur instanceof Error ? erreur.message : erreur
      }) — texte clair par défaut.`,
    );
    return "sombre";
  }
}
