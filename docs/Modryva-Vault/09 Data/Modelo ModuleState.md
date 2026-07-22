---
id: modryva-model-modulestate
title: Modelo ModuleState
type: model
domain: data
status: implemented
maturity: unknown
source:
  - packages/data/prisma/schema.prisma
  - packages/data/prisma/seed.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo ModuleState

## Propósito
Estado de un módulo (habilitado/deshabilitado/degradado) por tenant y opcionalmente por chat, con
`version` y `config`. Tabla `module_states`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | FK → [[Modelo Tenant]] (`onDelete: Cascade`). |
| `chatId` | String? | FK → [[Modelo Chat]] (opcional). |
| `moduleKey` | String | Clave del módulo. |
| `status` | [[Enum ModuleStatus]] | `@default(disabled)`. |
| `version` / `config` | String? / Json? | Metadatos. |

## Índices / restricciones
`@@unique([tenantId, chatId, moduleKey])`; `@@index([tenantId, moduleKey])`.

## Enums usados
[[Enum ModuleStatus]]

## Acceso
Solo **`seed.ts`** crea/actualiza `ModuleState` (siembra inicial). En runtime la habilitación efectiva
de módulos se resuelve vía [[Modelo ChatSetting]]. Ver [[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: `seed.ts` (siembra)
- Relacionado con: [[Modelo ChatSetting]], [[Modelo FeatureFlag]], [[Modelo Tenant]], [[Database Map]]
