---
id: modryva-games-collective-challenge
title: Reto Colectivo
type: feature
domain: games
status: partial
maturity: experimental
source:
  - modules/games/src/collective-challenge.ts
tags:
  - modryva
  - feature
  - games
aliases: ["collective challenge", "reto de conocimiento"]
created: 2026-07-12
updated: 2026-07-12
---

# Reto Colectivo

## Qué hace
Lógica pura para puntuar un reto de conocimiento del grupo contra el bot: cuenta aciertos, calcula el ratio y marca si el grupo gana al superar un umbral (60% por defecto).

## Evidencia
- `scoreCollectiveChallenge(answers, options)` (`modules/games/src/collective-challenge.ts:49-66`): `total` = nº de respuestas; `ratio` = `correct/total` redondeado a 2 decimales (`roundToTwo` L41); `won` = `ratio >= passRatio` (default 0.6, `collective-challenge.ts:35`). Con 0 respuestas → `{0,0,0,false}` (L61-63).
- Formas: `CollectiveChallengeAnswer{correct}` (`collective-challenge.ts:5-8`), `CollectiveChallengeScore` (`collective-challenge.ts:24-33`).
- Tests: `modules/games/src/collective-challenge.test.ts`.

## Estado / cableado
`partial`: **lógica pura sin cablear**. `scoreCollectiveChallenge` no se importa fuera de `modules/games/src`. No confundir con [[Recompensas Colectivas]] (`computeCollectiveReward`, SÍ usado por el [[Jefe Cooperativo]]): son módulos distintos.

## Preguntas abiertas
- El módulo solo puntúa una tanda de respuestas booleanas; la recolección de respuestas del grupo y la fuente de preguntas no existen aún.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Recompensas Colectivas]], [[Ciudad Cooperativa]], [[Jefe Cooperativo]], [[Banco de Trivia]]
