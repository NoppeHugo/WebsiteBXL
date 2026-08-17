import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),

  /**
   * Chemin du clone du dépôt sur le VPS. La console y écrit les `site.json`,
   * commite, pousse, puis déclenche build et déploiement : git reste la source
   * de vérité du contenu (README §3.6).
   */
  REPO_PATH: z.string().min(1),

  /** Change la valeur pour invalider immédiatement toutes les sessions. */
  SESSION_SECRET: z.string().min(32, "au moins 32 caractères"),

  /** Le cookie n'est envoyé qu'en HTTPS hors développement. */
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /** Durée de vie d'une session, en heures. */
  SESSION_HOURS: z.coerce.number().int().positive().default(12),

  /**
   * Machine qui construit et déploie réellement les sites, au format
   * `utilisateur@hôte`.
   *
   * La console ne peut pas s'en charger : les dépendances du dépôt sont
   * installées sur l'hôte en glibc, son image tourne en musl, et les binaires
   * natifs de rollup et sharp ne se partagent pas entre les deux. Elle se
   * connecte donc en ssh à l'hôte et y lance `scripts/publier.sh`, là où vivent
   * Node, les dépendances et /srv/sites.
   *
   * Vide, le bouton « Mettre en ligne » explique ce qui manque au lieu de
   * lancer une commande qui échouerait sans dire pourquoi.
   */
  PUBLISH_HOST: z.string().default(""),

  /** Clé lue par ssh et par git, dans le conteneur. */
  SSH_KEY: z.string().default("/ssh/id_ed25519"),

  /**
   * Chemin du dépôt **sur la machine hôte**, distinct de `REPO_PATH`.
   *
   * Les deux désignent le même dossier vu de deux endroits : `/repo` dans le
   * conteneur, `/srv/repo` sur la machine. La commande de publication part en
   * ssh et s'exécute donc là-bas — lui donner le chemin du conteneur la faisait
   * échouer sur « No such file or directory », en désignant un chemin qui
   * n'existe que de ce côté-ci.
   */
  PUBLISH_REPO: z.string().default("/srv/repo"),

  /**
   * Domaine de service, sous lequel vivent les sous-domaines des clients.
   *
   * Vide, il est déduit de `PUBLIC_ADMIN_URL` en retirant son premier label :
   * `https://admin.hairbxl.be` donne `hairbxl.be`. La déduction évite une
   * variable de plus à renseigner sur le serveur — chacune est une occasion
   * d'oubli, et un oubli ici ne se voit qu'au moment de créer un client.
   */
  SERVICE_DOMAIN: z.string().default(""),

  /**
   * Nom d'hôte de l'espace commerçant, par exemple `mon.hairbxl.be`.
   *
   * Le même programme sert les deux interfaces ; c'est ce nom qui décide
   * laquelle. Un domaine par usage : l'adresse remise au coiffeur ne donne
   * jamais sur la console qui gouverne les trente sites, même à quelqu'un qui
   * aurait les bons cookies.
   *
   * Vide, les deux mondes partagent l'hôte et seul le rôle du compte les
   * sépare — c'est le mode de développement, et il reste sûr.
   */
  PORTAL_HOST: z.string().default(""),

  /** Injecté dans les builds déclenchés depuis la console. */
  PUBLIC_API_URL: z.string().default(""),
  STRIPE_SECRET_KEY: z.string().optional(),
  PUBLIC_ADMIN_URL: z.string().default(""),

  /**
   * Envoi de courriels. L'interface écrit au client final quand le salon
   * annule un rendez-vous : sans cela, le client se présenterait devant une
   * porte fermée. Mêmes valeurs que pour l'API.
   */
  EMAIL_DRIVER: z.enum(["log", "resend", "smtp"]).default("log"),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("no-reply@example.com"),

  /** Relais SMTP — voir `apps/api/src/config.ts` pour le détail. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".")} — ${i.message}`)
    .join("\n");
  throw new Error(`configuration invalide :\n${issues}`);
}

export const config = parsed.data;
export const isProduction = config.NODE_ENV === "production";

/**
 * Domaine sous lequel sont créés les sous-domaines des nouveaux clients.
 *
 * Vide et sans `PUBLIC_ADMIN_URL` exploitable, la création de client demande
 * le domaine complet plutôt que d'en fabriquer un : un domaine deviné qui ne
 * résout pas produit un certificat refusé et un site injoignable.
 */
export function domaineDeService(): string {
  if (config.SERVICE_DOMAIN) return config.SERVICE_DOMAIN.toLowerCase();
  try {
    const hote = new URL(config.PUBLIC_ADMIN_URL).hostname;
    const labels = hote.split(".");
    // `admin.hairbxl.be` → `hairbxl.be`. En dessous de trois labels il n'y a
    // pas de sous-domaine à retirer, et retirer quand même donnerait `be`.
    return labels.length >= 3 ? labels.slice(1).join(".") : hote;
  } catch {
    return "";
  }
}

if (config.EMAIL_DRIVER === "resend" && !config.RESEND_API_KEY) {
  throw new Error("EMAIL_DRIVER=resend nécessite RESEND_API_KEY");
}
if (config.EMAIL_DRIVER === "smtp" && !(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS)) {
  throw new Error("EMAIL_DRIVER=smtp nécessite SMTP_HOST, SMTP_USER et SMTP_PASS");
}
if (isProduction && config.EMAIL_DRIVER === "log") {
  throw new Error(
    "EMAIL_DRIVER=log en production : un client dont le rendez-vous est annulé ne serait jamais prévenu.",
  );
}
