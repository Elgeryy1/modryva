---
id: modryva-model-chat
title: Modelo Chat
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/foundation-repository.ts
  - packages/data/src/platform-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Chat

## Propósito
Un chat de Telegram (grupo, supergrupo, canal o DM) conocido por un tenant. Es la identidad interna
(cuid) del chat; muchos modelos de config usan su `chatId`. Tabla `chats`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | FK → [[Modelo Tenant]] (`onDelete: Cascade`). |
| `telegramChatId` | BigInt | Id de Telegram. |
| `type` | String | group / supergroup / channel / private. |
| `title` / `username` | String? | Metadatos. |
| `isForum` | Boolean | `@default(false)` (temas/topics). |

## Índices / restricciones
`@@unique([tenantId, telegramChatId])`; `@@index([tenantId])`. Relaciones: `memberships`, `topics`,
`settings ChatSetting[]`, `modules ModuleState[]`, `cases ModerationCase[]`.

## Enums usados
Ninguno.

## Acceso
`foundation-repository.ts` (upsert de chat al ver actividad). Leído en `platform-repository.ts`.
La mayoría de repos reciben `chatId` ya resuelto.

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Membership]], [[Modelo Topic]], [[Modelo ChatSetting]], [[Modelo ModerationCase]]
- Relacionado con: [[Modelo Tenant]], [[Modelo AppUser]], [[Database Map]]
