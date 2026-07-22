---
id: modryva-model-ticketmessage
title: Modelo TicketMessage
type: model
domain: data
status: implemented
maturity: unknown
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo TicketMessage

## Propósito
Mensaje dentro de un hilo de [[Modelo Ticket]]. Tabla `ticket_messages`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `ticketId` | String | FK → [[Modelo Ticket]] (`onDelete: Cascade`). |
| `telegramUserId` | BigInt | Autor. |
| `body` | String | Contenido. |

## Índices / restricciones
`@@index([ticketId])`. FK a `Ticket`.

## Enums usados
Ninguno.

## Acceso
Relación declarada con `Ticket`, pero **sin lector/escritor verificado**: `ticket-repository.ts` no
crea/lee `TicketMessage` (los tickets se gestionan sin hilo de mensajes por ahora). Andamiaje; ver
[[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo Ticket]], [[Database Map]]
