---
id: modryva-model-chatsetting
title: Modelo ChatSetting
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/chat-setting-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo ChatSetting

## Propósito
Almacén clave-valor (`Json`) de ajustes por tenant/chat. Es el **backbone de configuración efectiva**
de Modryva: muchas features (incl. las que en el schema tienen tabla dedicada como flags/módulos) se
resuelven realmente aquí. Tabla `chat_settings`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | FK → [[Modelo Tenant]] (`onDelete: Cascade`). |
| `chatId` | String? | FK → [[Modelo Chat]] (null = ajuste a nivel tenant). |
| `key` | String | Clave del ajuste. |
| `value` | Json? | Valor. |

## Índices / restricciones
`@@unique([tenantId, chatId, key])`.

## Enums usados
Ninguno.

## Acceso
`chat-setting-repository.ts` (get/set por clave). Consumido transversalmente por casi todos los módulos
para leer/escribir configuración. Ver [[Settings Panel]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: la mayoría de módulos (configuración)
- Relacionado con: [[Modelo FeatureFlag]], [[Modelo ModuleState]], [[Modelo Chat]], [[Database Map]]
