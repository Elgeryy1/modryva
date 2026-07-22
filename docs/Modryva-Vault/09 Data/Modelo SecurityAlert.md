---
id: modryva-model-securityalert
title: Modelo SecurityAlert
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

# Modelo SecurityAlert

## Propósito
Alerta de seguridad con severidad, `code`, mensaje y `acknowledgedAt`. Tabla `security_alerts`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | FK → [[Modelo Tenant]] (`onDelete: SetNull`). |
| `severity` | String | `@default("info")`. |
| `code` / `message` | String | Identificador y texto. |
| `payload` | Json? | Contexto. |
| `acknowledgedAt` | DateTime? | Reconocida. |

## Índices / restricciones
`@@index([tenantId, severity])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado** en la capa de datos. En runtime las señales de seguridad se
canalizan por [[Modelo D1Event]]/[[Modelo QuarantineItem]] y [[Modelo AuditLog]]. Ver
[[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo AuditLog]], [[Modelo Tenant]], [[Security Map]], [[Database Map]]
