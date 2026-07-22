FROM node:24-bookworm-slim AS base

WORKDIR /app

# OpenSSL is required by the Prisma query engine at runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

# pnpm-workspace.yaml sets storeDir to "${TEMP}/..." for the Windows host workflow;
# define TEMP inside the Linux image so pnpm can resolve it.
ENV TEMP=/tmp

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json biome.json vitest.config.ts turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY modules ./modules
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

# Generate the Prisma client into node_modules so the apps can import it at runtime.
RUN node node_modules/prisma/build/index.js generate --schema packages/data/prisma/schema.prisma

ARG SERVICE=@superbot/bot
ENV SERVICE=${SERVICE}

# Build provenance — pass with `--build-arg APP_BUILD_SHA=$(git rev-parse HEAD)`
# (and APP_BUILD_TIME) so the running container exposes its exact source via
# GET /build-info. Defaults keep local/un-tagged builds working.
ARG APP_BUILD_SHA=unknown
ENV APP_BUILD_SHA=${APP_BUILD_SHA}
ARG APP_BUILD_TIME=unknown
ENV APP_BUILD_TIME=${APP_BUILD_TIME}

# The web service is a Next.js app: it must be built inside the image. Guarded by
# SERVICE so the bot/api/worker images skip it. Runs AFTER install + prisma
# generate. Keep the CMD as `next start` (build produces .next for it).
RUN sh -lc 'if [ "$SERVICE" = "@superbot/web" ]; then pnpm --filter @superbot/web build; fi'

CMD ["sh", "-lc", "pnpm --filter \"$SERVICE\" start"]
