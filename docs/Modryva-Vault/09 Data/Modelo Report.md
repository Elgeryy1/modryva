---
id: modryva-model-report
title: Modelo Report
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/moderation-extra-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Report

## Propósito
Denuncia de un usuario contra otro (comando `/report`): guarda el sujeto denunciado (id de Telegram),
el reportero y el motivo. Tabla `reports`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `chatId` | String? | Chat. |
| `reporterUserId` | String? | Quién denuncia. |
| `subjectTelegramId` | BigInt | Denunciado. |
| `reason` | String? | Motivo. |
| `status` | String | `@default("open")`. |

## Índices / restricciones
`@@index([tenantId, status])`. Sin `updatedAt`.

## Enums usados
Ninguno.

## Acceso
`moderation-extra-repository.ts` (crear/listar denuncias). Ver [[Módulo security]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: flujo de moderación reactiva
- Relacionado con: [[Modelo ModerationCase]], [[Modelo Chat]], [[Database Map]]
