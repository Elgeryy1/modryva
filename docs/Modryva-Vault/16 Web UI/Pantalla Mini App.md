---
id: modryva-pantalla-mini-app
title: Pantalla Mini App
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/page.tsx
  - apps/web/app/layout.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Pantalla home
  - Pantalla raiz
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla Mini App

## Qué es
Es la ruta raíz (`/`) de la Mini App: hace de **router de aterrizaje** y, si no hay deep link relevante, de **home del jugador** (perfil, juegos y ranking global). Cuando la Mini App se abre con nombre desde el menú del bot, esta pantalla decide a dónde ir según el `start_param` (`page.tsx:31-34`).

Lógica de enrutado en el `useEffect` de montaje (`page.tsx:39-80`):
- `casino` / `casino_*` → `/casino` (`page.tsx:43-46`).
- `help` → `/help` (`page.tsx:47-50`).
- `onb_<gid>` (onboarding) → `/config/onboarding` (`page.tsx:52-55`).
- `cfg_<gid>` (config) → `/config` (`page.tsx:56-59`).
- `game` / `inlineGame` / `gamesHub` → `/games` (`page.tsx:60-67`).
- Sin payload → carga el home del jugador (`page.tsx:68-80`).

El home muestra: héroe de perfil con nivel/racha/barra de progreso (`page.tsx:149-184`), "Jugar ahora" (trivia, boss, juegos, casino) (`page.tsx:187-226`), ranking global con medallas (`page.tsx:229-274`), logros/insignias (`page.tsx:277-297`), entradas secundarias (administrar grupo, pack de IA, guía) (`page.tsx:300-327`) y un **panel de operaciones solo visible al owner** (`page.tsx:330-334`). Pie con enlaces a `/privacy` y `/terms` (`page.tsx:336-342`).

## Ruta y componentes
- Ruta Next real: `/` (App Router, `apps/web/app/page.tsx`), client component (`"use client"`, `page.tsx:1`).
- Layout raíz `apps/web/app/layout.tsx`: `lang="es"` (`layout.tsx:12`) e inyecta el SDK de Telegram `telegram-web-app.js` con `strategy="beforeInteractive"` (`layout.tsx:15-18`).
- Componentes del kit UI: `Screen`, `AppHeader`, `Section`, `Group`, `Row`, `Empty`, `Banner`, `SkeletonList`, `GroupNote` (importados de `components/ui`, `page.tsx:7-18`).
- `DashboardPanel` (owner) desde `components/dashboard-panel` (`page.tsx:6`).

## Datos (API)
- `playerProfile()` → `POST /v1/games/profile` (perfil + top). Ver `[[Controller games]]`, `[[Servicio games]]`.
- `platformMe()` → `GET /v1/platform/me` (solo para saber `isOwner`, best-effort con `.catch(() => false)`, `page.tsx:72-74`). Ver `[[Controller platform]]`.
- `DashboardPanel` consume `getDashboard()` → `POST /v1/dashboard` (`dashboard-panel.tsx:26`). Ver `[[Controller dashboard]]`, `[[Servicio dashboard]]`.

## Estado
Implementada y cableada: enruta por `start_param` real y hace 2 llamadas en paralelo al montar (`page.tsx:70-80`). El decodificador `decodeStartParam` vive en `lib/config-meta.ts:61-101`.

## Preguntas abiertas
- El panel de operaciones del owner (`DashboardPanel`) depende de que `platformMe().isOwner` sea `true`; el criterio exacto de "owner" se resuelve en la API (`unknown` desde el front).

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Integración Telegram Mini Apps]], [[Guard InitData]]
- Relacionado con: [[Pantalla config]], [[Pantalla games]], [[Pantalla casino]], [[Pantalla ai-pack]], [[Pantalla help]], [[Pantalla platform]], [[Controller games]], [[Controller dashboard]], [[API Overview]]
