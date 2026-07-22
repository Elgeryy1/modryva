---
id: modryva-games-quiz-arcade
title: Quiz Arcade Solo
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/catalog.ts
  - modules/games/src/trivia.ts
  - apps/api/src/games/games.service.ts
tags:
  - modryva
  - feature
  - games
aliases: [quiz-arcade, "quiz solo"]
created: 2026-07-12
updated: 2026-07-12
---

# Quiz Arcade Solo

## Qué hace
Modo quiz individual (no compartido) del hub de juegos: sirve tandas de preguntas del banco completo para jugar en solitario, de forma efectivamente ilimitada. Cada tanda es determinista por `(usuario, ronda)` — recargar devuelve la misma tanda, pero cada ronda nueva avanza a preguntas distintas. La puntuación se acota server-side por el catálogo.

## Evidencia
- Spec del juego: `modules/games/src/catalog.ts:32-39` define `"quiz-arcade"` con `maxRawScore: 8`, `minDurationMs: 3_000`, `maxDurationMs: 300_000`.
- Servicio: `GamesService.quizBatch(userId, round, size=8)` (`apps/api/src/games/games.service.ts:416-450`) usa `dailyTriviaHash(\`${userId}:${round}\`) % pool.length` como offset (L433) y devuelve preguntas con `correctIndex` (el arcade puntúa en cliente; el score enviado sigue acotado por el catálogo, comentario L409-415).
- Banco: `TRIVIA_QUESTIONS` desde `modules/games/src/trivia.ts:12`; hash desde `modules/games/src/daily-trivia.ts:25-33`.
- Tests: `apps/api/src/games/games.service.test.ts`; `modules/games/src/catalog.test.ts`.
- Invocado en: `POST /v1/games/quiz` (`apps/api/src/games/games.controller.ts:118-123`).

## Estado / cableado
`implemented`. El envío de score reusa el mismo ciclo `start`/`submit` de arcade (ver [[Sesiones de Juego]]). A diferencia de la [[Trivia Diaria de Grupo]], no hay pregunta compartida ni gate por ventana: es juego libre solo.

## Preguntas abiertas
- `quizBatch` devuelve `correctIndex` al cliente (`games.service.ts:444`), por lo que el scoring correcto/incorrecto es client-side; el servidor solo acota el total. Igual que el resto de arcade, la superficie de trampa client-side no está cerrada.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]], [[Banco de Trivia]], [[Sesiones de Juego]], [[Catálogo Arcade y Anti-Cheat]]
- Relacionado con: [[Trivia Diaria de Grupo]], [[Quiz Adaptativo]], [[Comando trivia]]
