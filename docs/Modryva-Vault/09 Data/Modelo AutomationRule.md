---
id: modryva-model-automationrule
title: Modelo AutomationRule
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
aliases: [Modelo Automation]
created: 2026-07-12
updated: 2026-07-12
---

# Modelo AutomationRule

## Propósito
Regla de automatización por chat: cuando ocurre un trigger (`triggerKind`/`triggerValue`), ejecuta una
acción (`actionKind`/`actionValue`). Tabla `automation_rules`. (Distinto de
[[Owner Network Models|OwnerNetworkAutomation]], que opera a nivel de red.)

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `name` | String | Nombre de la regla. |
| `triggerKind` / `triggerValue` | String | Disparador. |
| `actionKind` / `actionValue` | String / String? | Acción. |
| `active` | Boolean | `@default(true)`. |
| `createdBy` | String? | Autor. |

## Índices / restricciones
`@@index([tenantId, chatId, active])`.

## Enums usados
Ninguno.

## Acceso
`d1-repository.ts` (CRUD y evaluación de reglas).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo Filter]], [[Modelo CustomCommand]], [[Database Map]]
