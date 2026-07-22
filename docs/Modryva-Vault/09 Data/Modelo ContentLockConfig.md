---
id: modryva-model-contentlockconfig
title: Modelo ContentLockConfig
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/content-lock-repository.ts
tags:
  - modryva
  - model
  - data
aliases: [Modelo ContentLock]
created: 2026-07-12
updated: 2026-07-12
---

# Modelo ContentLockConfig

## Propósito
Qué tipos de contenido están bloqueados en un chat (stickers, enlaces, media, etc.), guardado como
`Json`. Tabla `content_lock_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | String | `@unique`. |
| `locked` | Json | Conjunto de tipos bloqueados. |

## Índices / restricciones
`chatId @unique`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`content-lock-repository.ts` (leer/actualizar el set de locks; se consulta al filtrar mensajes). Ver
[[Módulo security]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: filtro de contenido de entrada
- Relacionado con: [[Modelo GroupHygieneConfig]], [[Modelo Chat]], [[Database Map]]
