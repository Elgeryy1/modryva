---
id: package-auth
title: Package auth
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - packages/auth/src/index.ts
  - packages/auth/src/policy.ts
  - packages/auth/src/rbac.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - architecture
  - security
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Package auth

`@superbot/auth` son los **primitivos de RBAC y policy** del bot: qué puede hacer cada rol y cómo se
evalúa una acción. Es lógica pura (sin acceso a datos ni a red).

## Qué exporta

`packages/auth/src/index.ts` reexporta:

- `rbac.ts` — `rolePermissions` (mapa `ActorRole → PermissionKey[]`), `resolvePermissions(role)`,
  `hasPermission(...)`. Los roles base son owner/admin/moderator/member/guest/system
  (`docs/ARCHITECTURE.md:58`).
- `policy.ts` — **`evaluatePolicy(...)`** que devuelve un `PolicyDecision`. Es el guard de autorización
  que consultan los handlers de moderación.

## Quién lo usa

[[Bot Update Service]] importa `evaluatePolicy` (`apps/bot/src/bot-update.service.ts:4`) para validar
permisos como `moderation.write` antes de aplicar sanciones. Los tests viven en `rbac.test.ts`.

## Aclaración importante (corrige el inventario)

A pesar de lo que sugiere [[Repository Inventory]] ("verificación de initData / autenticación"),
`@superbot/auth` **NO** hace verificación de `initData`. La verificación HMAC de `initData` de la Mini App
vive en **`apps/api/src/telegram-init-data.ts`** (usada por `InitDataGuard`), no en este paquete. Registrado
en [[Open Questions]].

## Relaciones

- Pertenece a: [[Architecture Map]]
- Depende de: [[Package domain]] (`ActorRole`)
- Utilizado por: [[Bot Update Service]]
- Relacionado con: [[Security Map]], [[Arquitectura General]]
