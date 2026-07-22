---
id: modryva-model-featureflag
title: Modelo FeatureFlag
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

# Modelo FeatureFlag

## Propósito
Flag de feature por tenant (clave + booleano + `payload`). Tabla `feature_flags`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | FK → [[Modelo Tenant]] (`onDelete: Cascade`). |
| `key` | String | Clave del flag. |
| `enabled` | Boolean | `@default(false)`. |
| `payload` | Json? | Config asociada. |

## Índices / restricciones
`@@unique([tenantId, key])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado**. La configuración efectiva de features vive en
[[Modelo ChatSetting]] (`chat_settings`), no aquí. Ver [[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo ChatSetting]], [[Modelo ModuleState]], [[Modelo Tenant]], [[Database Map]]
