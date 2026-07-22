---
id: modryva-games-speed-game
title: Juego de Velocidad
type: feature
domain: games
status: partial
maturity: experimental
source:
  - modules/games/src/speed-game.ts
tags:
  - modryva
  - feature
  - games
aliases: ["speed game", "reto de reacción"]
created: 2026-07-12
updated: 2026-07-12
---

# Juego de Velocidad

## Qué hace
Lógica pura para clasificar respuestas de un reto por tiempo de reacción: quien acierta antes gana.

## Evidencia
- `rankSpeedAnswers(answers)` (`modules/games/src/speed-game.ts:30-51`): ordena las respuestas correctas por `ms` ascendente; orden estable ante empates (conserva orden de aparición); descarta incorrectas.
- `speedWinner(answers)` (`speed-game.ts:58-62`): userId de la respuesta correcta más rápida, o `null` si no hay ninguna correcta.
- Determinista: sin `Date.now()`/`Math.random()`, recibe `SpeedAnswer{userId, correct, ms}` planos (`speed-game.ts:12-16`).
- Tests: `modules/games/src/speed-game.test.ts`.

## Estado / cableado
`partial`: **lógica pura sin cablear**. Grep confirma que `rankSpeedAnswers`/`speedWinner` solo aparecen en `modules/games/src` (fuente + test); ningún comando, API ni Mini App los invoca.

## Preguntas abiertas
- La captura de tiempos de reacción (por reacción a un mensaje, callback, etc.) no está implementada; el módulo solo clasifica tiempos ya medidos.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Juego de Memoria por Secuencia]], [[Torneo por Eliminatorias]]
