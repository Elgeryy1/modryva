---
id: modryva-model-reminder
title: Modelo Reminder
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

# Modelo Reminder

## Propósito
Recordatorio programado: se dispara en `runAt` y avisa al usuario en el chat. Guarda ids de Telegram
crudos para enviar sin resolver el chat interno. Tabla `reminders`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto interno. |
| `telegramChatId` / `telegramUserId` | BigInt | Destino Telegram. |
| `text` | String | Contenido. |
| `status` | String | `@default("pending")`. |
| `runAt` / `firedAt` | DateTime / DateTime? | Programación / disparo. |

## Índices / restricciones
`@@index([status, runAt])` (barrido del scheduler), `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`productivity-repository.ts` (crear; el worker/scheduler barre `status=pending` con `runAt` vencido).
Ver [[Infrastructure Map]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: scheduler ([[Infrastructure Map]])
- Relacionado con: [[Modelo ScheduledPost]], [[Modelo Task]], [[Database Map]]
