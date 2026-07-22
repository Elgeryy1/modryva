---
id: modryva-model-antifloodevent
title: Modelo AntifloodEvent
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/antiflood-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo AntifloodEvent

## Propósito
Registro de un disparo antiflood: usuario, número de mensajes en la ventana y acción tomada. Tabla
`antiflood_events`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramUserId` | BigInt | Usuario afectado. |
| `messageCount` / `windowSeconds` | Int | Métrica del disparo. |
| `action` | String | Acción aplicada. |

## Índices / restricciones
`@@index([tenantId, chatId, createdAt])`, `@@index([tenantId, telegramUserId])`.

## Enums usados
Ninguno.

## Acceso
`antiflood-repository.ts` (escritura al aplicar la sanción antiflood).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo AntifloodConfig]], [[Database Map]]
