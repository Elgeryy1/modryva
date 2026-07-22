---
id: modryva-games-bracket
title: Torneo por Eliminatorias
type: feature
domain: games
status: partial
maturity: experimental
source:
  - modules/games/src/bracket.ts
tags:
  - modryva
  - feature
  - games
aliases: [bracket, "torneo", "eliminatoria"]
created: 2026-07-12
updated: 2026-07-12
---

# Torneo por Eliminatorias

## Qué hace
Lógica pura de un bracket eliminatorio para torneos sociales (memes, equipos, retos): empareja participantes por orden y avanza ronda a ronda; con número impar, el último recibe un bye (pase directo).

## Evidencia
- `buildBracketRound(entrants)` (`modules/games/src/bracket.ts:28-43`): emparejamientos (0,1),(2,3),…; el impar sobrante recibe `BracketMatch` con `b === BRACKET_BYE` (`bracket.ts:13`).
- `advanceBracket(winners)` (`bracket.ts:51-58`): siguiente ronda desde los ganadores; con ≤1 ganador el torneo está decidido (campeón o vacío) → lista vacía.
- Determinista: sin I/O ni azar (comentario `bracket.ts:1-6`).
- Tests: `modules/games/src/bracket.test.ts`.

## Estado / cableado
`partial`: **lógica pura sin cablear**. Grep confirma que `buildBracketRound`/`advanceBracket` solo aparecen en `modules/games/src` (fuente + test). No hay comando ni UI que registre participantes, resuelva enfrentamientos ni persista el estado del torneo.

## Preguntas abiertas
- El módulo no decide ganadores de cada match (los recibe como input); la votación/resolución por enfrentamiento tendría que aportarla el caller inexistente.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Juego de Velocidad]], [[Reto de Creatividad]], [[Batalla de Playlists]]
