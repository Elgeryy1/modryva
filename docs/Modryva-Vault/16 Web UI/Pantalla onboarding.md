---
id: modryva-pantalla-onboarding
title: Pantalla onboarding
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/onboarding/page.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Configuracion inicial
  - Proposito y juegos
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla onboarding

## Qué es
**Configuración inicial** del bot en un grupo: pregunta el propósito (Administrar / Jugar / Las dos) y, si aplica, qué juegos activar. Es el destino del deep link `onb_<gid>` (vía `[[Pantalla Mini App]]`). Resuelve `gid` de query o `start_param` (`page.tsx:176-183`).

Fases (`Phase`, `page.tsx:135-142`):
- `purpose`: elige uso; recomienda según plantilla del bot (`recommendedPurpose`, `page.tsx:47-57`). **Si el bot no es admin** solo permite "Jugar" y bloquea las opciones de moderación (`page.tsx:329-336`, `345-351`, banner `page.tsx:345-351`).
- `games`: toggles por juego (tres en raya, RPS, quiz, trivia diaria, boss) y, si la trivia está activa, cadencia (diaria/cada hora) y "anunciar en el grupo" (`page.tsx:393-457`).
- `done`: éxito, con accesos a `/games` y (si `both`) a `/config` (`page.tsx:290-326`).

Al elegir "moderate" guarda y redirige directo a `/config?gid=<gid>` sin ruido (`page.tsx:229-242`, `save` `page.tsx:207-220`).

## Ruta y componentes
- Ruta Next real: `/config/onboarding` (`apps/web/app/config/onboarding/page.tsx`), client component con `<Suspense>` (`page.tsx:471-483`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Field`, `Group`, `GroupNote`, `Row`, `Section`, `Segmented`, `SkeletonList`, `Toggle`, `useBackButton` (`page.tsx:6-22`).

## Datos (API)
- `postSession(sp)` → `POST /v1/miniapp/session` (para `bot.template`, `bot.name` y `group.botIsAdmin`, `page.tsx:184-198`). Ver `[[Endpoint POST v1 miniapp session]]`.
- `getGamesConfig(gid)` → `GET /v1/miniapp/groups/{gid}/games-config` (`api.ts:580`).
- `putGamesConfig(gid, config)` → `PUT /v1/miniapp/groups/{gid}/games-config` (`api.ts:583`).
- Ver `[[Controller config]]`.

## Estado
Implementada y cableada. El fix de onboarding no-admin (gid en query + `botIsAdmin`) es coherente con la memoria del proyecto.

## Preguntas abiertas
- `recommendedPurpose` en el front es un espejo de `@superbot/shared` (comentado en `page.tsx:46-47`); si divergen, el default podría desincronizarse — no verificable desde aquí.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller config]], [[Pantalla games]], [[Pantalla wizard]], [[Endpoint POST v1 miniapp session]]
