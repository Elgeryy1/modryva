---
id: modryva-model-topic
title: Modelo Topic
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

# Modelo Topic

## Propósito
Tema (topic) de un grupo-foro de Telegram, ligado a un [[Modelo Chat]]. Tabla `topics`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | FKs (`onDelete: Cascade`). |
| `telegramTopicId` | Int | Id del tema en Telegram. |
| `title` | String? | Nombre del tema. |

## Índices / restricciones
`@@unique([chatId, telegramTopicId])`; `@@index([tenantId])`. Relación a `Tenant` y `Chat`.

## Enums usados
Ninguno.

## Acceso
Definido y relacionado con `Chat`, pero **sin lector/escritor verificado** en `packages/data/src` ni en
`apps/` (andamiaje). Ver [[Data Model Overview]] (modelos sin cablear) y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo Chat]], [[Modelo Tenant]], [[Database Map]]
