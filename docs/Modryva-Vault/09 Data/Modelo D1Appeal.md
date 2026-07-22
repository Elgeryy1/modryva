---
id: modryva-model-d1appeal
title: Modelo D1Appeal
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/d1-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo D1Appeal

## Propósito
Apelación operativa del centro de control D1 (referencia de caso libre, no FK). Es el **flujo de
apelaciones activo** del bot, en lugar del [[Modelo Appeal]] no cableado. Tabla `d1_appeals`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `chatId` | String? | Chat. |
| `caseRef` | String | Referencia de caso (texto). |
| `appellantTelegramId` | BigInt | Apelante. |
| `username` / `message` | String | Datos de la apelación. |
| `status` | String | `@default("open")`. |
| `resolvedBy` / `resolution` / `resolvedAt` | BigInt? / String? / DateTime? | Resolución. |

## Índices / restricciones
`@@index([tenantId, status, createdAt])`, `@@index([tenantId, appellantTelegramId])`.

## Enums usados
Ninguno.

## Acceso
`d1-repository.ts` (crear, listar, resolver apelaciones).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo Appeal]] (reemplazado), [[Modelo QuarantineItem]], [[Database Map]]
