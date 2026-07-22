---
id: modryva-model-blocklistentry
title: Modelo BlocklistEntry
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

# Modelo BlocklistEntry

## Propósito
Término prohibido concreto de un chat (con motivo). La acción al coincidir la define
[[Modelo BlocklistConfig]]. Tabla `blocklist_entries`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `trigger` | String | Término bloqueado. |
| `reason` | String? | Motivo. |

## Índices / restricciones
`@@unique([chatId, trigger])`; `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`group-protection-repository.ts` (añadir/quitar/listar términos; comprobar coincidencia).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: filtro de mensajes
- Relacionado con: [[Modelo BlocklistConfig]], [[Modelo Filter]], [[Database Map]]
