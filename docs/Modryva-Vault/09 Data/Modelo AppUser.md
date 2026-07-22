---
id: modryva-model-appuser
title: Modelo AppUser
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/foundation-repository.ts
  - packages/data/src/moderation-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo AppUser

## Propósito
Usuario conocido por el bot (identidad interna cuid ligada al `telegramUserId`). Es el nodo al que se
enganchan membresías, preferencias, avisos, sanciones y apelaciones. Tabla `users`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | FK → [[Modelo Tenant]] (`onDelete: SetNull`). |
| `telegramUserId` | BigInt | `@unique`. |
| `username` / `languageCode` / `displayName` | String? | Perfil. |

## Índices / restricciones
`telegramUserId @unique`; `@@index([tenantId])`. Relaciones: `memberships Membership[]`,
`preferences UserPreference?`, `bindings RoleBinding[]`, `warnings Warning[]`, `sanctions Sanction[]`,
`appeals Appeal[]`.

## Enums usados
Ninguno.

## Acceso
`foundation-repository.ts` (alta/upsert). Leído por `moderation-repository.ts`,
`moderation-extra-repository.ts`, `reputation-repository.ts`, `game-repository.ts` (resolver el usuario
interno desde el id de Telegram).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Membership]], [[Modelo Sanction]], [[Modelo Warning]], [[Modelo Appeal]], [[Modelo RoleBinding]], [[Modelo UserPreference]]
- Relacionado con: [[Modelo Tenant]], [[Modelo Chat]], [[Database Map]]
