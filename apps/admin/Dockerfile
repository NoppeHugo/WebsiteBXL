# Interface d'administration.
#
# L'image embarque git, pnpm et rsync : la console commite le contenu et
# demande la mise en ligne. Elle a donc besoin des mêmes outils que
# l'exploitation manuelle — sans quoi il faudrait dupliquer cette logique
# ailleurs.

FROM node:22-alpine

RUN apk add --no-cache git openssh-client rsync bash && corepack enable

# Un compte portant l'identité du propriétaire du dépôt sur l'hôte.
#
# Le conteneur tourne sous cet UID pour que git accepte d'ouvrir /repo. Mais un
# UID sans ligne dans /etc/passwd n'a ni nom ni répertoire personnel, et ssh
# refuse alors de démarrer : « No user exists for uid 1002 ». Le push vers
# GitHub et la demande de publication échouaient tous deux là.
#
# L'UID est un argument de construction : il doit correspondre au compte
# `deploy` de la machine, dont le numéro varie d'une installation à l'autre.
ARG DEPLOY_UID=1002
ARG DEPLOY_GID=1002
RUN if ! getent group "$DEPLOY_GID" >/dev/null; then addgroup -g "$DEPLOY_GID" app; fi \
 && if ! getent passwd "$DEPLOY_UID" >/dev/null; then \
      adduser -D -u "$DEPLOY_UID" -G "$(getent group "$DEPLOY_GID" | cut -d: -f1)" -h /home/app app; \
    fi \
 && install -d -o "$DEPLOY_UID" -g "$DEPLOY_GID" /home/app

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/schema/package.json ./packages/schema/
# @bxl/admin dépend de @bxl/api (rapports, facturation, avis de rendez-vous,
# transport des courriels). Son manifeste doit être présent AVANT l'installation
# pour que pnpm résolve la dépendance de l'espace de travail ; ses sources
# doivent l'être après, puisqu'elles s'exécutent telles quelles.
COPY apps/api/package.json ./apps/api/
COPY apps/admin/package.json ./apps/admin/

RUN pnpm install --frozen-lockfile --filter @bxl/admin...

COPY packages/schema ./packages/schema
COPY apps/api ./apps/api
COPY apps/admin ./apps/admin

WORKDIR /app/apps/admin

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "src/index.ts"]
