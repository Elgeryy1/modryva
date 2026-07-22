---
id: modryva-model-d1event
title: Modelo D1Event
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
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo D1Event

## Propósito
Evento del centro de control D1 (moderación/seguridad/actividad): `kind`, título, cuerpo y `payload`.
Alimenta el feed de eventos del log. Tabla `d1_events`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `chatId` | String? | Chat origen. |
| `kind` | String | Tipo de evento. |
| `title` / `body` | String / String? | Contenido. |
| `payload` | Json? | Datos extra. |

## Índices / restricciones
`@@index([tenantId, chatId, createdAt])`, `@@index([tenantId, kind])`.

## Enums usados
Ninguno.

## Acceso
`d1-repository.ts` (registrar y listar eventos). Consumido por el log de la [[Observability Map]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo D1LogConfig]], [[Modelo AuditLog]], [[Database Map]]
