---
id: modryva-model-customcommand
title: Modelo CustomCommand
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/custom-command-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo CustomCommand

## Propósito
Comando personalizado por chat: al invocar `name`, el bot responde `response`. Tabla `custom_commands`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `name` | String | Nombre del comando. |
| `response` | String | Respuesta. |
| `createdBy` | String? | Autor. |

## Índices / restricciones
`@@unique([chatId, name])`; `@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
`custom-command-repository.ts` (CRUD y resolución de comandos custom).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Custom Commands]]
- Relacionado con: [[Modelo Filter]], [[Modelo Note]], [[Modelo AutomationRule]], [[Database Map]]
