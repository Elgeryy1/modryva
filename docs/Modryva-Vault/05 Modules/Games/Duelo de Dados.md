---
id: modryva-games-dice-duel
title: Duelo de Dados
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/dice-duel.ts
  - apps/bot/src/bot-update.service.ts
  - packages/data/src/chip-repository.ts
tags:
  - modryva
  - feature
  - games
aliases: [duelo, "dice duel", "duelo pvp"]
created: 2026-07-12
updated: 2026-07-12
---

# Duelo de Dados

## Qué hace
Duelo PvP nativo en chat con fichas: dos jugadores apuestan y el bot lanza dos 🎲 reales de Telegram; gana el número más alto, empate devuelve las apuestas. La casa cobra un **rake** sobre el bote al pagar (no hay ventaja por tirada porque el juego es simétrico).

## Evidencia
- Resolver puro (`modules/games/src/dice-duel.ts`): `resolveDuel(rollA, rollB)` (`dice-duel.ts:38-46`) compara dos valores 1..6 (`DuelWinner` 0/1/2); lanza `RangeError` fuera de rango. `duelPayout(pot, rake?)` (`dice-duel.ts:54-63`) = `floor(pot*(1-rake))`, `DEFAULT_DUEL_RAKE = 0.05` (`dice-duel.ts:28`). `describeDuel(...)` (`dice-duel.ts:66-81`) arma la línea en español.
- Cableado en chat (`apps/bot/src/bot-update.service.ts`): lanza 2 `sendDice` reales (`bot-update.service.ts:2956-2968`), resuelve con `resolveDuel` (L2980) y liquida con `this.chipRepository.settleDuel(tenantId, duelId, winner, CASINO.duelRake)` (L2981-2986); si fallan los dados, devuelve apuestas (L2969-2977). Render con `describeDuel` (L2994).
- Imports: `apps/bot/src/bot-update.service.ts:358-359` (`resolveDice`, `resolveDuel`), `:339` (`describeDuel`).
- Tests: `modules/games/src/dice-duel.test.ts`.

## Estado / cableado
`implemented`: PvP nativo con flujo aceptar-reto → `sendDice` de Telegram (provably-fair por construcción: el bot no puede trucar la tirada) → liquidación atómica en `chip-repository`. Casino social; el rake es la única fuente de casa. Nota: `modules/games/src/dice-duel.ts` es distinto de `resolveDice` (apuesta de dado individual, `bot-update.service.ts:2781`).

## Preguntas abiertas
- El registro/aceptación del reto (`duelId`, `claim.challengerName`) lo gestiona el `chip-repository` (`settleDuel`), fuera del alcance de este módulo puro; ver [[Chip Economy]] para el ledger.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]], [[Chip Economy]]
- Relacionado con: [[Casino Map]], [[Provably Fair]], [[Comando casino]]
