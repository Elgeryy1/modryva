---
id: enum-platformrole
title: Enum PlatformRole
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - model
  - data
  - enum
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Enum PlatformRole

Rol a nivel de **plataforma** (no de grupo) concedido a un usuario de Telegram vía
[[Modelo PlatformRoleAssignment]].

## Valores

| Valor | Significado |
|---|---|
| `platform_owner` | Dueño de la plataforma (máximo privilegio). |
| `promo_admin` | Gestiona códigos promocionales. |
| `bot_factory_admin` | Gestiona la fábrica de bots hijos. |
| `support_admin` | Administración de soporte. |
| `auditor` | Auditoría (lectura). |

Sin default: el `role` es obligatorio en la asignación.

## Usado por

- [[Modelo PlatformRoleAssignment]] — campo `role PlatformRole` (con `@@index([role])`).

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo PlatformRoleAssignment]]
- Relacionado con: [[Database Map]], [[Modryva Hub Map]]
