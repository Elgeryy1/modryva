---
id: modryva-model-platformroleassignment
title: Modelo PlatformRoleAssignment
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/platform-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo PlatformRoleAssignment

## Propósito
Asigna un rol de plataforma (dueño, admin de promos, admin de fábrica de bots, soporte, auditor) a un
usuario de Telegram. Es el RBAC global de la plataforma, distinto del RBAC por tenant. Tabla
`platform_role_assignments`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `telegramUserId` | BigInt | Usuario destinatario. |
| `role` | [[Enum PlatformRole]] | Rol concedido. |
| `grantedByTelegramId` | BigInt? | Quién lo concedió. |
| `revokedAt` | DateTime? | Revocación (soft). |

## Índices / restricciones
`@@index([telegramUserId])`, `@@index([role])`. Sin `@unique` compuesto: un usuario puede acumular
varios roles.

## Enums usados
[[Enum PlatformRole]]

## Acceso
`platform-repository.ts` (concesión/revocación y comprobación de permisos de plataforma).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: control de acceso de la [[Modryva Hub Map]]
- Relacionado con: [[Modelo PlatformUserBan]], [[Database Map]]
