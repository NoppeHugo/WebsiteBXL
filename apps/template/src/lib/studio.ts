/**
 * Identité du studio, signée en pied de page de chaque site livré.
 *
 * C'est le canal d'acquisition le moins cher du projet : un commerçant qui
 * remarque le site du voisin trouve immédiatement à qui s'adresser. À remplir
 * dès que le nom commercial et le domaine du studio sont arrêtés.
 */
export const STUDIO = {
  name: "Hugo Noppe",
  /** Mettre l'URL du site vitrine du studio, ou une chaîne vide pour masquer. */
  url: "",

  /**
   * Hébergeur à déclarer dans les mentions légales. La loi belge impose de
   * nommer l'hébergeur du site : puisque les sites tournent sur notre propre
   * serveur, c'est le fournisseur du VPS qu'il faut indiquer ici, avec sa
   * raison sociale et son adresse.
   */
  hosting: {
    name: "À compléter (fournisseur du VPS)",
    address: "",
  },
} as const;
