# Modryva

**Modryva** es un bot modular de Telegram para gestión y dinamización de comunidades,
construido como un monorepo TypeScript de grado producción. Reúne moderación,
verificación de acceso ("guardian"), juegos y casino social de fichas virtuales,
chat con IA, Mini Apps y una plataforma de sub-bots gestionados — todo sobre un
único esquema de datos y una arquitectura de monolito modular.

> Nombre interno del paquete raíz: `superbot`. El producto es **Modryva**.

## Qué incluye

- 🛡️ **Moderación** — filtros, notas, anti-raid, moderación de reacciones (Bot API 10.0), auditoría.
- ✅ **Guardian** — verificación de acceso configurable (foto → staff, auto-declaración de edad, gates de liveness).
- 🎮 **Juegos y casino social** — juegos de chat + mesa Mini App, economía de fichas *provably-fair*, integración con Telegram Stars.
- 🤖 **IA** — chat por mención, memoria explícita estilo "recuerda que…", sanitización y redacción de secretos en prompts.
- 🧩 **Mini Apps** — panel web nativo de Telegram (tema claro/oscuro) para configuración y juegos.
- 🏗️ **Plataforma** — bot padre que concede acceso y gestiona sub-bots hijos (managed bots).

## Arquitectura

Monolito modular en un monorepo **pnpm + Turborepo**. Tres tipos de workspace,
un único esquema Prisma compartido:

```
apps/        procesos desplegables
  bot        NestJS + Fastify · long-polling de Telegram, dispatch de updates
  api        NestJS + Fastify · Mini App, contratos internos, bootstrap
  web        Next.js + React  · Mini App y panel
  worker     Fastify + BullMQ · tareas asíncronas
packages/    librerías transversales
  domain · data (Prisma) · telegram (gateway) · auth · shared
modules/     features de dominio (lógica pura, un fichero + su test)
  ai · automation · community · core · files · games · payments · security · support
```

El bot principal corre por **long-polling**; los sub-bots gestionados se sirven por **webhook**.
Detalle en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) y en el vault de documentación (`docs/Modryva-Vault/`).

## Stack

TypeScript estricto · NestJS · Fastify · Next.js 15 · React 19 · Prisma 6 + PostgreSQL 16 ·
Redis + BullMQ · Vitest · Biome · pnpm 11 · Node 24.

## Arranque rápido

Requisitos: **Node ≥ 24**, **pnpm ≥ 11**, y Docker (para Postgres + Redis).

```bash
pnpm install
cp .env.example .env        # rellena tus valores (ver la sección Configuración)
docker compose up -d postgres redis
pnpm db:generate
pnpm db:deploy              # aplica las migraciones sobre una base limpia
pnpm dev
```

Servicios en local:

| Servicio | URL |
|---|---|
| Bot    | http://localhost:3002 |
| API    | http://localhost:3001 |
| Web    | http://localhost:3003 |
| Worker | http://localhost:3004 |

Para crear tu propio bot y obtener un token, sigue [`docs/BOTFATHER.md`](docs/BOTFATHER.md).

## Configuración

Toda la configuración se toma de variables de entorno. Copia `.env.example` a `.env`
y rellena, como mínimo:

- `DATABASE_URL` — Postgres.
- `REDIS_URL` — Redis.
- `TELEGRAM_BOT_TOKEN` — el token de tu bot (de [@BotFather](https://t.me/BotFather)).
- `TELEGRAM_WEBHOOK_SECRET`, `SESSION_SECRET` — secretos generados por ti.

`.env.example` documenta el conjunto completo. **Nunca** commitees tu `.env` real.

## Validación

```bash
pnpm lint         # Biome + lint de copy
pnpm typecheck    # tsc --noEmit en todos los workspaces
pnpm test         # Vitest
pnpm build
```

La integración continua (`.github/workflows/ci.yml`) además reconstruye el esquema
desde cero, verifica que las migraciones cubren el schema (sin drift de `db push`) y
corre los tests de integración contra un Postgres real.

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura y decisiones base.
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — comandos, pnpm, Docker y notas de entorno.
- [`docs/COMMANDS.md`](docs/COMMANDS.md) — referencia de comandos del bot.
- `docs/Modryva-Vault/` — base de conocimiento interlazada (arquitectura, módulos, datos, API, workflows). Se lee mejor con [Obsidian](https://obsidian.md), pero es Markdown estándar.

## Contribuir

Lee [`CONTRIBUTING.md`](CONTRIBUTING.md). En resumen: todo cambio pasa lint + typecheck + test.

## Seguridad

¿Encontraste una vulnerabilidad? No abras un issue público — sigue [`SECURITY.md`](SECURITY.md).

## Licencia

[AGPL-3.0](LICENSE). Puedes usar, estudiar, modificar y redistribuir Modryva; si lo
ofreces como servicio en red, debes poner a disposición de los usuarios el código
fuente de tu versión, incluidas tus modificaciones.

© 2026 Gerard Alvear y los contribuidores de Modryva.
