---
id: endpoint-post-v1-casino-bet
title: Endpoint POST v1 casino bet
type: endpoint
domain: api
status: implemented
maturity: stable
source: [apps/api/src/casino/casino.controller.ts, apps/api/src/casino/casino.service.ts]
tags: [modryva, endpoint, api]
aliases: [POST /v1/casino/bet]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint POST v1 casino bet

`bet()` en [[Controller casino]] (`apps/api/src/casino/casino.controller.ts:28`). Apuesta instantánea provably-fair en el casino de fichas.

## Entrada

- Body: `{ game, stake, params }` (`params` opcional según el juego).
- Cabecera `Authorization: tma <initData>`.

## Salida

`{ ok, payout, multiplier, balance, detail, proof: { commit, clientSeed, nonce } }` y, opcionalmente, `jackpotWon` + `jackpot` cuando la capa social del jackpot paga el bote (`apps/web/lib/api.ts:773`). El controller delega en `casino.instantBet(userId, game, stake, params)` ([[Servicio casino]]).

## Auth y errores

`@UseGuards(InitDataGuard)`; el tenant sale del bot servidor. Errores como `{ error: "<code>" }`: `insufficient`, `invalid-stake`, `invalid-params`, `unknown-game`, `no-tenant`, … La web los traduce a español en `CASINO_ERROR_ES` (`apps/web/lib/api.ts:48`).

## Consumidor

`casinoBet(game, stake, params)` en `apps/web/lib/api.ts:773`.

## Relaciones

- **Pertenece a**: [[Controller casino]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio casino]].
- **Utilizado por**: [[Pantalla casino]] (`casinoBet`).
- **Consume**: [[Modelo CasinoBet]], [[Modelo CasinoBalance]], [[Modelo CasinoJackpot]].
- **Relacionado con**: [[Controller games]], [[API Map]].
