---
id: modryva-model-paneleditstate
title: Modelo PanelEditState
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/group-protection-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo PanelEditState

## Propósito
Estado efímero de edición del panel de configuración inline: qué campo está editando un usuario y para
qué grupo, para capturar el siguiente mensaje como valor. Tabla `panel_edit_states`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `telegramUserId` | BigInt | Editor. |
| `field` | String | Campo en edición. |
| `groupTelegramChatId` | BigInt | Grupo objetivo. |

## Índices / restricciones
`@@unique([tenantId, telegramUserId])` (un estado de edición por usuario).

## Enums usados
Ninguno.

## Acceso
`group-protection-repository.ts` (set al abrir edición, get al recibir el mensaje de valor). Ver
[[Settings Panel]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Settings Panel]]
- Relacionado con: [[Modelo ChatSetting]], [[Database Map]]
