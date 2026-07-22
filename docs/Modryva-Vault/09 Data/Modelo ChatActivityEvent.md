---
id: modryva-model-chatactivityevent
title: Modelo ChatActivityEvent
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/chat-activity-repository.ts
tags:
  - modryva
  - model
  - data
aliases: [Modelo ChatActivity]
created: 2026-07-12
updated: 2026-07-12
---

# Modelo ChatActivityEvent

## Propósito
Log rodante genérico de actividad de chat. Un solo modelo para varios detectores ambientales (cambios de
tono, usuarios calientes, temas tensos, spam copy-paste…) sin tabla por detector: `kind` discrimina la
forma del evento y los campos no usados quedan a null. Tabla `chat_activity_events`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `kind` | String | Discriminador del evento. |
| `telegramUserId` / `username` | BigInt? / String? | Autor. |
| `text` / `topic` / `messageId` | String? / BigInt? | Contenido. |
| `hasLink` / `hasMention` / `isReply` | Boolean | Flags de forma. |
| `repliedToUserId` | BigInt? | Respuesta a. |
| `tensionScore` | Float? | Métrica de tensión. |

## Índices / restricciones
`@@index([tenantId, chatId, createdAt])`, `@@index([tenantId, chatId, kind, createdAt])`,
`@@index([tenantId, chatId, messageId])`.

## Enums usados
Ninguno.

## Acceso
`chat-activity-repository.ts` (append de eventos + ventanas de historial reciente para los detectores de
seguridad/comunidad ambiental).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: detectores ambientales ([[Módulo security]], [[Módulo community]])
- Relacionado con: [[Modelo D1Event]], [[Modelo UserActivity]], [[Database Map]]
