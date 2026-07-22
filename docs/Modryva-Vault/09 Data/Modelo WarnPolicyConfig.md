---
id: modryva-model-warnpolicyconfig
title: Modelo WarnPolicyConfig
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/moderation-extra-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo WarnPolicyConfig

## Propósito
Política de avisos por chat: límite de warns, acción al alcanzarlo (mute/ban…), duración y caducidad de
los warns. Gobierna a [[Modelo Warning]]. Tabla `warn_policy_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | String | `@unique`. |
| `warnLimit` | Int | `@default(3)`. |
| `warnMode` | String | `@default("mute")`. |
| `durationMs` / `expireMs` | BigInt? | Duración de la sanción / caducidad de warns. |

## Índices / restricciones
`chatId @unique`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`moderation-extra-repository.ts` (leer/actualizar política; se consulta al añadir un warn). Ver
[[Módulo security]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Warning]]
- Relacionado con: [[Modelo Sanction]], [[Modelo Chat]], [[Database Map]]
