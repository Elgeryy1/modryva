---
id: modryva-model-ticket
title: Modelo Ticket
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/ticket-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Ticket

## Propósito
Ticket de soporte en un chat, numerado por tenant, con asunto, estado, prioridad y asignado. Sus
mensajes van en [[Modelo TicketMessage]]. Tabla `tickets`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `reporterTelegramId` | BigInt | Quien abre. |
| `subject` | String | Asunto. |
| `status` | String | `@default("open")`. |
| `priority` | String | `@default("normal")`. |
| `assigneeTelegramId` | BigInt? | Asignado. |
| `number` | Int | Correlativo por tenant. |
| `closedAt` | DateTime? | Cierre. |

## Índices / restricciones
`@@unique([tenantId, number])`; `@@index([tenantId, chatId, status])`. Relación
`messages TicketMessage[]`.

## Enums usados
Ninguno.

## Acceso
`ticket-repository.ts` (abrir/asignar/cerrar/listar; numeración por tenant).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo TicketMessage]]
- Relacionado con: [[Modelo FeedbackConfig]], [[Database Map]]
