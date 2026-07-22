---
id: modryva-model-userpreference
title: Modelo UserPreference
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

# Modelo UserPreference

## Propósito
Preferencias 1:1 de un [[Modelo AppUser]]: locale, zona horaria, formato de fecha, accesibilidad y
notificaciones. Tabla `user_preferences`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `userId` | String | `@unique` — FK 1:1 → [[Modelo AppUser]] (`onDelete: Cascade`). |
| `locale` | String | `@default("es")`. |
| `timezone` | String | `@default("Europe/Madrid")`. |
| `dateFormat` | String | `@default("dd/MM/yyyy")`. |
| `accessibility` / `notifications` | Json? | Ajustes flexibles. |

## Índices / restricciones
`userId @unique` (relación 1:1 con `AppUser`).

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado** en `packages/data/src` ni en `apps/` (andamiaje). Ver
[[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo AppUser]], [[Database Map]]
