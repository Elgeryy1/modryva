---
id: modryva-model-policyrule
title: Modelo PolicyRule
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

# Modelo PolicyRule

## Propósito
Regla de política genérica (patrón → acción) por tenant/chat, con `scope` y `config`. Tabla
`policy_rules`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `chatId` | String? | Chat (opcional). |
| `name` | String | Nombre de la regla. |
| `scope` | String | `@default("chat")`. |
| `action` | [[Enum PolicyAction]] | allow/warn/delete/mute/ban/review. |
| `pattern` / `config` | String? / Json? | Coincidencia y ajustes. |

## Índices / restricciones
`@@unique([tenantId, chatId, name])`.

## Enums usados
[[Enum PolicyAction]]

## Acceso
**Sin lector/escritor verificado**. El filtrado efectivo lo cubren [[Modelo Filter]],
[[Modelo BlocklistEntry]] y [[Modelo AutomationRule]]. Ver [[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo Filter]], [[Modelo AutomationRule]], [[Database Map]]
