FROM node:22-alpine AS base
# Cache-bust marker: 2026-04-25 — bumped to pick up react-server-dom-webpack 19.2.5.
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- build ----
FROM deps AS build
COPY packages/shared-types ./packages/shared-types
COPY packages/api-client ./packages/api-client
COPY packages/api ./packages/api
RUN pnpm --filter @ghar-kharcha/api build

# ---- deploy (flattens node_modules, no workspace symlinks) ----
FROM build AS deploy
RUN pnpm --filter @ghar-kharcha/api deploy --prod --legacy /deploy

# ---- runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deploy /deploy .

EXPOSE 3000
CMD ["node", "dist/index.js"]
