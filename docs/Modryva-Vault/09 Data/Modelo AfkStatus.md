---
id: modryva-model-afkstatus
title: Modelo AfkStatus
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/productivity-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo AfkStatus

## Propósito
Estado AFK (ausente) de un usuario en un tenant, con motivo. Al mencionarlo, el bot avisa que está
ausente. Tabla `afk_statuses`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `telegramUserId` | BigInt | Usuario. |
| `username` / `reason` | String? | Nombre y motivo. |
| `since` | DateTime | `@default(now())`. |

## Índices / restricciones
`@@unique([tenantId, telegramUserId])`; `@@index([tenantId, username])`.

## Enums usados
Ninguno.

## Acceso
`productivity-repository.ts` (marcar/limpiar AFK, consultar por mención). Ver [[AFK]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[AFK]]
- Relacionado con: [[Modelo Task]], [[Modelo Reminder]], [[Database Map]]
