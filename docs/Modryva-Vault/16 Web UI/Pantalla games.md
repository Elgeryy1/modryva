---
id: modryva-pantalla-games
title: Pantalla games
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/games/page.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Hub de juegos
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla games

## Qué es
**Hub de juegos** de la Mini App: juegos de habilidad y clásicos en solitario, juegos de comunidad (trivia diaria, boss cooperativo), acceso al casino y clasificación. Cada partida suma puntos.

Vistas (`View`, `page.tsx:97-102`):
- `hub`: rejilla de juegos por sección — Habilidad (reflejos, quiz arcade, parejas, cálculo rápido), Clásicos (tres en raya, RPS), Comunidad (trivia diaria, boss), Apuestas (casino) (`page.tsx:240-292`).
- `playing`: renderiza el componente del juego elegido; al terminar llama `finish` → `submitScore` (`page.tsx:142-153`, `188-200`).
- `result`: pantalla de "¡Bien jugado! +N puntos" + nudge portable + board (`page.tsx:202-225`).
- `daily` / `boss`: componentes `DailyTrivia` / `CoopBoss` (`page.tsx:180-186`).

Deep link: `game`/`inlineGame` autoarranca el juego (o daily/boss) en el montaje (`page.tsx:164-177`). El `PortableNudge` solo aparece cuando el scope es `portable` (jugadores fuera de grupo) para invitar a añadir Modryva a un grupo (`page.tsx:300-338`).

## Ruta y componentes
- Ruta Next real: `/games` (`apps/web/app/games/page.tsx`), client component (`page.tsx:1`).
- Componentes de juego en `components/games/*.tsx` (coop-boss, daily-trivia, math-sprint, memory-game, quiz-arcade, reflex-game, rps-game, tic-tac-toe).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Group`, `GroupNote`, `Row`, `Section`, `useBackButton` (`page.tsx:12-24`).

## Datos (API) — bajo `/v1/games/*`
- `startGame(game)` → `POST /v1/games/start` (`api.ts:443`).
- `submitScore(sessionId, score)` → `POST /v1/games/submit` (`api.ts:449`).
- `gamesLeaderboard()` → `POST /v1/games/leaderboard` (`api.ts:455`).
- `postSession(startParam)` → `POST /v1/miniapp/session` (para conocer el bot y el nudge, `page.tsx:161-163`).
- Ver `[[Controller games]]`, `[[Servicio games]]`.

## Estado
Implementada y cableada. El leaderboard tiene tres scopes: `group`, `portable`, `personal` (`page.tsx:343-355`).

## Preguntas abiertas
- La lógica de puntuación (`submitScore` → `points`) y anti-trampa la calcula la API — `unknown` desde el front.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Integración Telegram Mini Apps]], [[Guard InitData]]
- Relacionado con: [[Controller games]], [[Pantalla casino]], [[Pantalla Mini App]], [[Pantalla onboarding]], [[Pantalla gamification]]
