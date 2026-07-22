---
id: modryva-model-feed
title: Modelo Feed
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/feed-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Feed

## Propósito
Suscripción a un feed (RSS/Atom) que el bot sondea y publica en un chat. Guarda el último ítem visto
para no repetir. Tabla `feeds`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto interno. |
| `telegramChatId` | BigInt | Chat destino. |
| `url` | String | URL del feed. |
| `lastItemGuid` | String? | Último ítem publicado. |
| `status` | String | `@default("active")`. |
| `createdBy` / `lastPolledAt` | String? / DateTime? | Autor / último sondeo. |

## Índices / restricciones
`@@unique([chatId, url])`; `@@index([status])`, `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`feed-repository.ts` (alta/baja; el worker sondea `status=active` y publica novedades).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: worker de sondeo ([[Infrastructure Map]])
- Relacionado con: [[Modelo ScheduledPost]], [[Modelo Webhook]], [[Database Map]]
