---
id: modryva-model-antiraidconfig
title: Modelo AntiraidConfig
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/antiraid-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo AntiraidConfig

## Propósito
Config antiraid por chat: umbral de entradas por ventana, modo (observe/enforce), edad mínima de cuenta
y ventana de "bajo ataque". Tabla `antiraid_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | String | `@unique`. |
| `enabled` | Boolean | `@default(false)`. |
| `windowSeconds` / `joinLimit` | Int | Ventana y límite de joins. |
| `mode` | String | `@default("observe")`. |
| `newAccountAgeDays` | Int | Edad mínima de cuenta. |
| `underAttackUntil` | DateTime? | Modo bajo ataque activo. |

## Índices / restricciones
`chatId @unique`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`antiraid-repository.ts` (config + detección de oleadas → [[Modelo AntiraidEvent]]). Ver
[[Módulo security]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo AntiraidEvent]]
- Relacionado con: [[Modelo AntifloodConfig]], [[Modelo Chat]], [[Database Map]]
