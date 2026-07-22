---
id: modryva-games-catalog
title: Catálogo Arcade y Anti-Cheat
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/catalog.ts
tags:
  - modryva
  - feature
  - games
aliases: ["game catalog", "GAME_CATALOG", "anti-cheat"]
created: 2026-07-12
updated: 2026-07-12
---

# Catálogo Arcade y Anti-Cheat

## Qué hace
Catálogo puro de los juegos arcade + helpers server-side de anti-trampa. Define cada juego (título, emoji, ventana temporal esperada, puntuación bruta máxima), valida un score enviado contra sus topes de plausibilidad y normaliza el bruto a 0..3 puntos para que arcade quede comparable con quiz/trivia en el `GameScore` compartido.

## Evidencia
- `GameId` (`modules/games/src/catalog.ts:6-12`): `reflex | quiz-arcade | memory | math-sprint | tictactoe | rps`.
- `GAME_CATALOG` (`catalog.ts:23-76`): specs por juego. P.ej. `reflex` `maxRawScore 100` / 800ms-120s (L24-31); `quiz-arcade` `maxRawScore 8` / 3s-300s (L32-39); `memory` "Parejas" `maxRawScore 100` (L40-47); `math-sprint` `maxRawScore 20` (L48-55); `tictactoe` `maxRawScore 3` (L60-67); `rps` `maxRawScore 5` (L68-75).
- `isGameId` (`catalog.ts:80-81`); `isPlausibleScore(game, rawScore, elapsedMs)` (`catalog.ts:89-106`): rechaza rango fuera de `[0, maxRawScore]` o tiempo fuera de la ventana. Docstring L83-88 lo marca como "primera línea de defensa".
- `scoreToPoints(game, rawScore)` (`catalog.ts:108-114`): fracción `clamped/maxRawScore` → `round(fraction*3)`, acotado 0..3.
- Tests: `modules/games/src/catalog.test.ts`.
- Invocado en: `apps/api/src/games/games.service.ts` (`start`/`submit`/`quizBatch`).

## Estado / cableado
`implemented`. Es el contrato que consume [[Sesiones de Juego]] para validar y puntuar. Añadir un juego arcade = añadir un `GameSpec` aquí + su tablero cliente en `apps/web/components/games/`.

## Preguntas abiertas
- `reflex`, `memory` (Parejas) y `math-sprint` tienen tablero cliente pero no tienen nota propia aún; su lógica de juego es client-side (no hay resolver puro en `modules/games/src` para ellos, a diferencia de trivia/boss).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Sesiones de Juego]], [[Tres en Raya]], [[Piedra Papel Tijera]], [[Quiz Arcade Solo]], [[Modelo GameScore]]
