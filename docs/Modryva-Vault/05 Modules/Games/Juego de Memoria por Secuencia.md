---
id: modryva-games-memory-sequence
title: Juego de Memoria por Secuencia
type: feature
domain: games
status: partial
maturity: experimental
source:
  - modules/games/src/memory-game.ts
tags:
  - modryva
  - feature
  - games
aliases: ["memoria de secuencia", "simon"]
created: 2026-07-12
updated: 2026-07-12
---

# Juego de Memoria por Secuencia

## Qué hace
Lógica pura de un minijuego tipo "Simón": el bot genera una secuencia de números determinista a partir de una semilla; el jugador la reproduce y se compara contra la esperada.

## Evidencia
- `generateMemorySequence(seed, length, maxValue)` (`modules/games/src/memory-game.ts:28-52`): PRNG reproducible (variante mulberry32, `hashStep` L13-18) sin `Math.random`; misma terna → misma secuencia.
- `checkMemoryAnswer(expected, given)` (`memory-game.ts:71-90`): cuenta aciertos por posición (`matched`) y marca `correct` solo si misma longitud y todos los elementos coinciden.
- Tests: `modules/games/src/memory-game.test.ts`.

## Estado / cableado
`partial`: **lógica pura sin cablear**. Grep confirma que `generateMemorySequence`/`checkMemoryAnswer` solo aparecen en `modules/games/src` (fuente + test). Ojo con la homonimia: el hub de la Mini App tiene un juego `"memory"` ("Parejas", `modules/games/src/catalog.ts:40-47`) que es un **memory de emparejar cartas** puntuado en cliente y NO usa este módulo de secuencias.

## Preguntas abiertas
- ¿Se pensó como arcade de la Mini App o como juego nativo en chat? Sin consumidor no se puede determinar la superficie prevista.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Catálogo Arcade y Anti-Cheat]], [[Juego de Velocidad]]
