---
id: modryva-pantalla-users
title: Pantalla users
type: screen
domain: web
status: partial
maturity: stable
source:
  - apps/web/app/config/users/page.tsx
  - apps/web/lib/api-user-panel.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Panel de usuario
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla users

## Qué es
**Panel de usuario**: busca un usuario por su ID de Telegram, revisa su historial (advertencias, reportes, riesgo) y gestiona su rol interno y notas de staff. Requiere `gid` (`page.tsx:62-83`).

Bloques (`page.tsx:143-306`):
- Búsqueda por ID → `getUserPanelProfile`.
- Perfil: en red o no, advertencias activas, reportes como sujeto, puntuación de riesgo (o "no disponible").
- Advertencias y reportes en detalle (si los hay).
- Rol interno: `select` con roles `owner`, `network_manager`, `moderator`, `support`, `analyst`, `read_only` (`page.tsx:28-35`); editable solo si `canManageRole` (`page.tsx:250-284`). El rol solo controla el acceso al panel de la Mini App, no sustituye a admin real de Telegram (`page.tsx:253-255`).
- Nota interna de staff → `addUserPanelNote`.

Errores mapeados: `invalid-telegram-user-id`, `not-in-network`, `not-network-owner`, `invalid-body` (`page.tsx:37-43`).

## Ruta y componentes
- Ruta Next real: `/config/users` (`apps/web/app/config/users/page.tsx`), client component con `<Suspense>` (`page.tsx:311-323`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Field`, `Group`, `Row`, `Section`, `SkeletonList`, `useBackButton` (`page.tsx:5-17`).

## Datos (API) — bajo `/v1/miniapp/groups/{gid}/users/{telegramUserId}`
- `getUserPanelProfile` → `GET .../users/{id}` (`api-user-panel.ts:50`).
- `setUserPanelRole` → `POST .../users/{id}/role` (`api-user-panel.ts:59`).
- `addUserPanelNote` → `POST .../users/{id}/notes` (`api-user-panel.ts:69`).
- Ver `[[Controller user-panel]]`.

## Estado
`partial`: las notas de staff pueden no persistir — la UI distingue `result.persisted` y muestra "Nota registrada solo en esta sesión: todavía no hay almacén de notas" cuando es `false` (`page.tsx:116-120`). El resto del perfil y el cambio de rol sí operan.

## Preguntas abiertas
- Almacén definitivo de notas internas (`persisted: false`) — pendiente de backend, `unknown`.
- La puntuación de riesgo depende de que el módulo de riesgo de red esté activo (`page.tsx:207-214`).

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller user-panel]], [[Pantalla risk]], [[Pantalla moderation]], [[Pantalla network]]
