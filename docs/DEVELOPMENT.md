# Desarrollo

## Requisitos

- Node.js 24+
- pnpm 11.7+
- Docker y Docker Compose para Postgres/Redis

## Comandos

```bash
pnpm install
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Windows Y Rutas De Red

El workspace vive en una unidad `Z:` que resuelve a UNC/SMB. pnpm intenta usar
symlinks para workspace/store y Windows puede bloquearlos. Por eso
`pnpm-workspace.yaml` fija:

- `nodeLinker: hoisted`
- `packageImportMethod: copy`
- `storeDir: "${TEMP}/pnpm-ultrabot-store"`
- `verifyDepsBeforeRun: false`

Los scripts publicos evitan `.bin` y `pnpm --dir` para que funcionen tambien en
este entorno.

## Smoke Local

API:

```bash
node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.base.json apps/api/src/index.ts
```

Bot:

```bash
node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.base.json apps/bot/src/index.ts
```

Endpoints:

- `GET http://127.0.0.1:3001/health`
- `GET http://127.0.0.1:3002/health`
- `POST http://127.0.0.1:3002/telegram/webhook/superbot_bot/simulate`

## Docker

```bash
docker compose up --build
```

Compose levanta Postgres, Redis, bot, API, worker y web. Antes de usar webhook
real, define `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` y
`SUPERBOT_OWNER_TELEGRAM_ID`.

## Comandos De Moderacion Fase 1.1

```text
/warn <telegram_user_id> [motivo]
/ban <telegram_user_id> [motivo]
/mute <telegram_user_id> <10m|2h|7d> [motivo]
```

Usan ids numericos de Telegram para garantizar persistencia e idempotencia.
