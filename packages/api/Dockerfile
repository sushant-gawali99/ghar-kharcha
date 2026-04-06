FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @ghar-kharcha/api... --ignore-scripts

# ---- build ----
FROM deps AS build
COPY packages/shared-types ./packages/shared-types
COPY packages/api ./packages/api
RUN pnpm --filter @ghar-kharcha/api build

# ---- runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/packages/api/dist ./dist
COPY --from=build /app/packages/api/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/index.js"]
