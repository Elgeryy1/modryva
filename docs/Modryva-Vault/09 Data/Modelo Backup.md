---
id: modryva-model-backup
title: Modelo Backup
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

# Modelo Backup

## Propósito
Metadatos de una copia de seguridad: tipo, estado, referencia de almacenamiento y checksum. Tabla
`backups`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | Tenant. |
| `kind` | String | Tipo de backup. |
| `status` | String | `@default("pending")`. |
| `storageRef` / `checksum` | String? | Ubicación e integridad. |
| `completedAt` | DateTime? | Fin. |

## Índices / restricciones
`@@index([tenantId, status])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado** (andamiaje de operación no cableado). Ver [[Data Model Overview]] y
[[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Infrastructure Map]], [[Modelo Tenant]], [[Database Map]]
