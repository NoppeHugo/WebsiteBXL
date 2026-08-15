# API de réservation et de contact.
#
# Image volontairement simple : le service est petit, opéré par une seule
# personne, et TypeScript est exécuté directement par Node 22 — pas d'étape de
# compilation, donc rien qui puisse diverger entre le développement et la
# production.

FROM node:22-alpine

RUN corepack enable

WORKDIR /app

# Les manifestes d'abord : la couche d'installation reste en cache tant que les
# dépendances ne changent pas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/schema/package.json ./packages/schema/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @bxl/api...

COPY packages/schema ./packages/schema
COPY apps/api ./apps/api

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3000

# Le conteneur est déclaré en bonne santé seulement si la base répond aussi :
# une API debout mais sans base ne sert à rien.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "src/index.ts"]
