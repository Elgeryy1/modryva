---
id: modryva-games-streak
title: Racha de Juego
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/streak.ts
  - apps/api/src/games/games.service.ts
tags:
  - modryva
  - feature
  - games
aliases: [streak, racha, computeStreak]
created: 2026-07-12
updated: 2026-07-12
---

# Racha de Juego

## Qué hace
Calcula los días consecutivos que un jugador lleva jugando. La racha sigue viva si jugó hoy O ayer (aún no jugó hoy pero no la ha roto); se rompe si el último día jugado es anterior a ayer.

## Evidencia
- `computeStreak(dayKeys, todayKey)` (`modules/games/src/streak.ts:8-36`): normaliza las claves de día jugadas a un `Set`, ancla en hoy o ayer (`streak.ts:20-27`) y cuenta hacia atrás mientras haya días contiguos (L29-35). Determinista, sin `Date.now()`.
- Fuente de días jugados: marcador `daily_play` (idempotente por día) que `GamesService.markDailyPlay` (`apps/api/src/games/games.service.ts:776-799`) escribe tras cada juego; se lee en `playerProfile` (`games.service.ts:817-845`) y se pasa a `computeStreak` (L840-845).
- Tests: `modules/games/src/streak.test.ts`.
- Invocado en: `POST /v1/games/profile` (`apps/api/src/games/games.controller.ts:78-86`).

## Estado / cableado
`implemented`. `markDailyPlay` se dispara desde `submit`, `answerDailyTrivia` y `attackBoss` (best-effort, nunca rompe el juego que lo dispara). El marcador reusa `ChatActivityEvent` en el scope personal (`dm:<tenant>:<user>`), 0 migraciones (comentario `games.service.ts:68-70`).

## Preguntas abiertas
- La ventana de día usa `DAILY_TZ_OFFSET_MIN = 0` (UTC), igual que la trivia; no hay racha por zona horaria del usuario.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Nivel de Jugador]], [[Trivia Diaria de Grupo]], [[Jefe Cooperativo]], [[Sesiones de Juego]]
