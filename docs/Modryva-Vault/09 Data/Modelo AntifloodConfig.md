---
id: modryva-model-antifloodconfig
title: Modelo AntifloodConfig
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

# Modelo AntifloodConfig

## Propósito
Config antiflood por chat: cuántos mensajes en cuántos segundos disparan una acción, y con qué mute y
cooldown. Tabla `antiflood_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | String | `@unique` (una config por chat). |
| `enabled` | Boolean | `@default(false)`. |
| `windowSeconds` / `messageLimit` | Int | Ventana y límite. |
| `action` | String | `@default("mute")`. |
| `muteSeconds` / `cooldownSeconds` | Int | Duración de mute / enfriamiento. |
| `exempt` | Json? | Exenciones. |

## Índices / restricciones
`chatId @unique`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`antiflood-repository.ts` (leer/actualizar config; registrar disparos → [[Modelo AntifloodEvent]]).
Ver [[Módulo security]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo AntifloodEvent]]
- Relacionado con: [[Modelo AntiraidConfig]], [[Modelo Chat]], [[Database Map]]
