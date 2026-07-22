---
id: modryva-games-quiz-adaptive
title: Quiz Adaptativo
type: feature
domain: games
status: partial
maturity: experimental
source:
  - modules/games/src/quiz-adaptive.ts
tags:
  - modryva
  - feature
  - games
aliases: [quiz-adaptive, "dificultad adaptativa"]
created: 2026-07-12
updated: 2026-07-12
---

# Quiz Adaptativo

## Qué hace
Lógica pura para ajustar la dificultad de un quiz (nivel 1..5) según el rendimiento del jugador: sube cuando la precisión es alta, baja cuando es baja, se mantiene en la zona media.

## Evidencia
- `accuracy(perf)` (`modules/games/src/quiz-adaptive.ts:42-50`): precisión 0..1, segura ante `total` 0 o negativo.
- `nextDifficulty(current, perf)` (`quiz-adaptive.ts:58-76`): sube nivel si `acc >= QUIZ_RAISE_THRESHOLD (0.8)`, baja si `< QUIZ_LOWER_THRESHOLD (0.4)`; clamp a 1..5 (`clampDifficulty` L27-35). Sin preguntas respondidas no cambia.
- Umbrales exportados: `quiz-adaptive.ts:19` y `:22`.
- Tests: `modules/games/src/quiz-adaptive.test.ts`.

## Estado / cableado
`partial`: **lógica pura sin cablear**. Grep confirma que `nextDifficulty`/`accuracy` solo aparecen en `modules/games/src` (fuente + test); no se importan desde `apps/api`, `apps/bot`, `apps/worker` ni `apps/web`. El [[Quiz Arcade Solo]] cableado NO usa este módulo (sirve tandas del banco sin dificultad adaptativa).

## Preguntas abiertas
- No hay consumidor que persista el nivel entre tandas ni una fuente de preguntas etiquetadas por dificultad conectada a este ajuste (aunque `TriviaQuestion` tiene un campo opcional `difficulty`, `modules/games/src/trivia.ts:9`).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Quiz Arcade Solo]], [[Banco de Trivia]], [[Trivia Diaria de Grupo]]
