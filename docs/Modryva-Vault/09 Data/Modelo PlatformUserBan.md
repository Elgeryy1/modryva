---
id: modryva-model-platformuserban
title: Modelo PlatformUserBan
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/platform-repository.ts
tags:
  - modryva
  - model
  - data
aliases: [Platform User Ban]
created: 2026-07-12
updated: 2026-07-12
---

# Modelo PlatformUserBan

## Propósito
Veta a un usuario de Telegram del uso de la plataforma completa (no de un grupo concreto). Con caducidad
y revocación opcionales. Tabla `platform_user_bans`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `telegramUserId` | BigInt | `@unique` (un ban activo por usuario). |
| `reason` | String | Motivo. |
| `bannedByTelegramId` | BigInt | Quién lo baneó. |
| `bannedAt` | DateTime | `@default(now())`. |
| `expiresAt` / `revokedAt` | DateTime? | Caducidad / revocación. |

## Índices / restricciones
`telegramUserId @unique`; `@@index([revokedAt])`, `@@index([expiresAt])`.

## Enums usados
Ninguno.

## Acceso
`platform-repository.ts` (crear ban, comprobar si un usuario está vetado a nivel plataforma).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: gate de acceso de la [[Modryva Hub Map]]
- Relacionado con: [[Modelo PlatformRoleAssignment]], [[Database Map]]
