---
id: modryva-model-feedbackconfig
title: Modelo FeedbackConfig
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/feedback-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo FeedbackConfig

## Propósito
Config de feedback/soporte por tenant: a qué chat de staff se reenvían los mensajes de feedback de los
usuarios. Tabla `feedback_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | `@unique` (una config por tenant). |
| `staffTelegramChatId` | BigInt | Chat de staff destino. |

## Índices / restricciones
`tenantId @unique`.

## Enums usados
Ninguno.

## Acceso
`feedback-repository.ts` (leer/actualizar el chat de staff; enrutar feedback).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo FeedbackUser]]
- Relacionado con: [[Modelo Ticket]], [[Database Map]]
