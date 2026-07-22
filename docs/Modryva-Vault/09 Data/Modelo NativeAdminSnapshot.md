---
id: modryva-model-nativeadminsnapshot
title: Modelo NativeAdminSnapshot
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

# Modelo NativeAdminSnapshot

## Propósito
Instantánea (`payload Json`) de los permisos de administrador nativos de Telegram de un usuario en un
chat, para cachear/auditar el estado real de admin. Tabla `native_admin_snapshots`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` / `userId` | String | Contexto (sin FK declarada). |
| `payload` | Json | Permisos capturados. |
| `capturedAt` | DateTime | `@default(now())`. |

## Índices / restricciones
`@@index([tenantId, chatId])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado** en la capa de datos ni en `apps/`. Ver [[Data Model Overview]] y
[[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo Chat]], [[Modelo AppUser]], [[Database Map]]
