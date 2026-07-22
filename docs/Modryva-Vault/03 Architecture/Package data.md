---
id: package-data
title: Package data
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - packages/data/src/index.ts
  - packages/data/src/client.js
  - packages/data/prisma/schema.prisma
  - apps/bot/src/app.module.ts
tags:
  - modryva
  - architecture
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Package data

`@superbot/data` es la **capa de persistencia**: el Prisma Client, el `schema.prisma` y ~45 repositorios,
cada uno con su implementación `Prisma*` (real) y su hermana `InMemory*` (tests / fallback). Es el único
punto que toca Postgres.

## Qué exporta

`packages/data/src/index.ts` reexporta un fichero por dominio (`packages/data/src/*-repository.ts`), entre
otros: `foundation-repository` (tenants/bots/chats/users/memberships, `ensureContext`, `claimUpdate`,
`recordAudit`, `markUpdateProcessed`), `moderation`, `moderation-extra`, `antiflood`, `antiraid`,
`captcha`, `content-lock`, `notes`, `filters`, `welcome`, `reputation`, `invite`, `analytics`, `poll`,
`giveaway`, `scheduled-post`, `ticket`, `productivity`, `feed`, `webhook`, `custom-command`, `file`,
`game`, `chip`, `ai`, `ai-access`, `payment`, `platform`, `federation`, `feedback`, `staff-note`,
`economy`, `incident`, `coop-mission`, `gratitude`, `gamification`, `automation`, `owner-network`(+`risk`),
`group-protection`, `chat-activity`, `chat-setting`, `d1`, `entitlement`, `expiration`, `internal-role`,
`community`. También `client.js` (`prisma`, singleton).

El esquema Prisma (`packages/data/prisma/schema.prisma`) define **~127 modelos + 11 enums** (ver
[[Database Map]]).

## Patrón

Cada repo se inyecta por token `Symbol` (`apps/bot/src/tokens.ts`) y se cablea en `BotAppModule` con un
`useFactory: () => new Prisma<X>Repository()`. En [[Bot Update Service]], varios repos "opcionales"
(`@Optional()`) caen a su `InMemory*` si no hay provider — lo que permite tests y arranque parcial.

## Quién lo usa

- [[App bot]] — ~45 repos en `app.module.ts` + constructor de [[Bot Update Service]].
- [[App api]] — lecturas/escrituras de la Mini App.
- [[App worker]] — expiraciones, RSS, recaps, webhooks.

## Relaciones

- Pertenece a: [[Architecture Map]]
- Depende de: [[Package domain]], Prisma, PostgreSQL
- Utilizado por: [[App bot]], [[App api]], [[App worker]]
- Relacionado con: [[Database Map]], [[Bot Update Service]], [[Arquitectura General]]
