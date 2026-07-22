---
id: modryva-games-creativity-challenge
title: Reto de Creatividad
type: feature
domain: games
status: partial
maturity: experimental
source:
  - modules/games/src/creativity-challenge.ts
tags:
  - modryva
  - feature
  - games
aliases: ["creativity challenge", "concurso de memes"]
created: 2026-07-12
updated: 2026-07-12
---

# Reto de Creatividad

## Qué hace
Lógica pura para resolver un mini-concurso de creatividad (meme, idea, diseño, frase o historia): ordena las propuestas por votos y elige ganador.

## Evidencia
- `resolveCreativityChallenge(entries)` (`modules/games/src/creativity-challenge.ts:32-52`): ranking por votos descendente, desempate por `id` ascendente (orden determinista); `winnerId` = primera entrada o `undefined` si no hay propuestas. No muta la entrada.
- Formas: `CreativityChallengeEntry{id, votes}` (`creativity-challenge.ts:6-11`, votos pueden ser negativos por down-votes), `CreativityChallengeResult` (`creativity-challenge.ts:18-23`).
- Tests: `modules/games/src/creativity-challenge.test.ts`.

## Estado / cableado
`partial`: **lógica pura sin cablear**. `resolveCreativityChallenge` no se importa fuera de `modules/games/src`. No hay flujo que recoja propuestas ni contabilice votos.

## Preguntas abiertas
- La recolección de propuestas y el conteo de votos (reacciones, encuesta) no están implementados; el módulo solo rankea votos ya agregados.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Batalla de Playlists]], [[Duelo de Debate]], [[Torneo por Eliminatorias]]
