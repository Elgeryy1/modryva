---
id: modryva-command-dado
title: Comando dado
type: command
domain: casino
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - modules/games/src/casino.ts
tags:
  - modryva
  - command
  - casino
aliases:
  - "/dado"
  - "/apostar"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /dado

## Propósito
Juego de dados con apuesta (dice bet provably-fair): apuestas a "bajo/alto" respecto a un objetivo 1-99 y
cobras según el multiplicador.

## Sintaxis
`/dado <apuesta> [bajo|alto] [objetivo 1-99]` (ej. `/dado 100 bajo 50`). Alias `/apostar`. Nombres en
`modules/games/src/casino.ts:119`; usage en `casino.ts:156`.

## Permisos
Ninguno especial (por usuario). No requiere bot admin. La apuesta debe estar entre `CASINO.minBet` y
`CASINO.maxBet` (`bot-update.service.ts:2729`).

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`), rama por defecto de apuesta (2728). Usa
`chipRepository.placeBet(...)` con `resolveDice(serverSeed, clientSeed, nonce, side, target)` — resultado
determinista por HMAC (provably-fair). Debita, resuelve y acredita el pago en una operación.

## Modelos que toca
[[Modelo ChipWallet]] + ledger de apuestas (`chipRepository.placeBet`).

## Eventos
Ninguno vía `recordAudit`; el ledger registra debit/win con `betId`.

## Errores / edge-cases
"Fichas insuficientes" (sugiere `/bono`). Apuesta fuera de rango: mensaje de límites min/max.

## Tests
`modules/games/src/casino.ts` (parser + `resolveDice`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]]
- Produce: [[Modelo ChipWallet]]
- Relacionado con: [[Comando tragaperras]], [[Comando mm]], [[Comando diana]], [[Casino Bet Lifecycle]]
