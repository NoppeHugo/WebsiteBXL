# Interface d'administration.
#
# L'image embarque git, pnpm et rsync : la console commite le contenu, lance le
# build et déclenche le déploiement. Elle a donc besoin des mêmes outils que
# l'exploitation manuelle — sans quoi il faudrait dupliquer cette logique
# ailleurs.

FROM node:22-alpine

RUN apk add --no-cache git openssh-client rsync bash && corepack enable

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
