---
id: modryva-games-daily-trivia
title: Trivia Diaria de Grupo
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/daily-trivia.ts
  - apps/api/src/games/games.service.ts
  - apps/worker/src/trivia-announce-processor.ts
tags:
  - modryva
  - feature
  - games
aliases: [dailytrivia, "trivia diaria"]
created: 2026-07-12
updated: 2026-07-12
---

# Trivia Diaria de Grupo

## Qué hace
Una misma pregunta compartida por todos los miembros de un grupo durante una ventana (día o hora), respondida desde la Mini App. La selección es determinista por ventana, así que todos ven la misma pregunta y el mismo día genera siempre la misma. El primer acierto suma puntos al leaderboard del scope.

## Evidencia
- Selección determinista pura (`modules/games/src/daily-trivia.ts`):
  - `dayKeyFromMs(nowMs, tzOffset)` (`daily-trivia.ts:61-66`) y `hourKeyFromMs` (`daily-trivia.ts:77-82`) fijan el bucket de ventana (UTC, offset 0). Comentario `daily-trivia.ts:68-76`: los buckets horarios (~490k) nunca colisionan con los diarios (~20k), así un grupo alterna cadencia sin mezclar marcadores.
  - `dailyTriviaHash` (FNV-1a 32-bit, `daily-trivia.ts:25-33`) y `pickDailyIndex(dayKey, poolSize)` (`daily-trivia.ts:42-52`) eligen la pregunta sin `Math.random`.
- Servicio (`apps/api/src/games/games.service.ts`):
  - `dailyTrivia` (`games.service.ts:458-506`): resuelve scope, cadencia (`triviaCadenceFor` L386-400, desde `GamesConfig`), elige la pregunta, y **oculta `correctIndex` hasta que el usuario responde** (L496).
  - `answerDailyTrivia` (`games.service.ts:513-566`): idempotente por ventana (segundo intento = no-op que repite el resultado); acierto en primer intento suma `DAILY_TRIVIA_POINTS = 2` (`games.service.ts:67`, `L554-558`). El marcador reusa `ChatActivityEvent` (kind `daily_trivia`, `messageId=dayKey`).
- Anuncio programado: `apps/worker/src/trivia-announce-processor.ts:65-157` publica una tarjeta "¡Nueva trivia!" con botón a la Mini App una vez por ventana (idempotente vía `{lastWindow}` en `ChatSetting`). Solo grupos que opten (`config.announce && config.games.dailytrivia`, L86) y solo tenant del bot primario (L91).
- Tests: `modules/games/src/daily-trivia.test.ts`; `apps/api/src/games/games.service.test.ts`.
- Invocado en: `POST /v1/games/daily` y `/daily/answer` (`apps/api/src/games/games.controller.ts:88-116`).

## Estado / cableado
`implemented`. Preguntas del banco vía `TRIVIA_QUESTIONS` (ver [[Banco de Trivia]]). Cadencia `daily`/`hourly` configurable por grupo en `GamesConfig` (personal/portable siempre `daily`, `games.service.ts:386-400`).

## Preguntas abiertas
- El `DAILY_TZ_OFFSET_MIN` está fijado a 0 (UTC) tanto en API (`games.service.ts:65`) como en worker (`trivia-announce-processor.ts:15`); no hay ventana por zona horaria del grupo.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]], [[Banco de Trivia]]
- Relacionado con: [[Jefe Cooperativo]], [[Racha de Juego]], [[Modelo GameScore]], [[Comando trivia]], [[Comando jugar]]
