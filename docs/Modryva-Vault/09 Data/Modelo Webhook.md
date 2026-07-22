---
id: modryva-model-webhook
title: Modelo Webhook
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/webhook-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Webhook

## Propósito
Webhook saliente configurado por un chat: URL + secreto a los que el bot notifica eventos. Las entregas
concretas van en [[Modelo WebhookDelivery]]. Tabla `webhooks`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `url` | String | Endpoint. |
| `secret` | String | Firma HMAC. |
| `active` | Boolean | `@default(true)`. |
| `createdBy` | String? | Autor. |

## Índices / restricciones
`@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`webhook-repository.ts` (CRUD; encolar entregas). Ver [[Integrations Map]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo WebhookDelivery]]
- Relacionado con: [[Modelo Feed]], [[Database Map]]
