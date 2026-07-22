---
id: juego-crash
title: Juego Crash
type: feature
domain: casino
source: [modules/games/src/crash.ts, apps/api/src/casino/casino.service.ts, apps/web/components/casino/Crash.tsx]
status: implemented
maturity: stable
tags: [modryva, feature, casino]
aliases: [crash, cohete, rocket]
created: 2026-07-12
updated: 2026-07-12
---

# Juego Crash

Cohete 🚀 multi-paso de la Mini App: apuestas, el multiplicador sube y debes **retirar antes de que explote**.

## Lógica pura (`modules/games/src/crash.ts`)

- **Distribución + house edge**: se sortea `f ∈ [0,1)` con `fairFloat` y `crash = floor((0.99/f)*100)/100`, acotado a `[1.00, MAX_CRASH=1000]`. El factor `CRASH_EDGE_FACTOR = 0.99` (`crash.ts:31`) es el **1% de ventaja**: un juego justo usaría `1.00/f`. `crashPoint` `crash.ts:48-59`.
- **Liquidación**: `settleCrash(crash, cashoutAt, stake)` (`crash.ts:67-81`) — gana si `cashoutAt <= crash`; `payout = floor(stake * cashoutAt)`. **Paga al retiro elegido, no al punto de crash.**
- `MAX_CRASH = 1000` acota el pago y mantiene el JSON seguro (`crash.ts:28`).

## Multiplicador / house edge
`P(crash ≥ x) = 0.99/x` ⇒ ventaja de casa **+1%** por construcción (los ~1% de rondas que "instant-crash" se acotan a 1.00).

## Flujo API (multi-paso)

`crashStart` (`casino.service.ts:352-384`) fija el `crash` en el `state` del [[Modelo CasinoBet]] al empezar y devuelve `betId` + `commit`. `crashCashout` (L386-412) liquida contra el `crash` guardado y **revela** el `serverSeed`. Endpoints `POST /v1/casino/crash/start` y `/cashout`.

## Componente web y estado (`apps/web/components/casino/Crash.tsx`)

- Estado: `stake`, `betId`, `mult` (multiplicador vivo), `error`.
- Animación: la subida se anima con `requestAnimationFrame` (aceleración natural `BASE_RATE 0.28` + `ACCEL 0.16`, L37-38), curva SVG inline con cabeza dorada; el crash hace flash rojo + shake. Todo tras `prefers-reduced-motion` (fallback en timer, L120-127).
- **Reentrancy**: refs `busy`/`settling` bloquean doble-tap de start/cashout (L82-84); en unmount se liquida la bet huérfana con el último multiplicador (`crashCashout` best-effort, L208-225).
- Errores terminales (`no-bet`/`bet-closed`/`wrong-game`) limpian la ronda en vez de dejar al jugador atascado (L25-27).

## Relaciones

- Pertenece a: [[Módulo games]]
- Depende de: [[Provably Fair]] (`fairFloat`), [[Casino Bet Lifecycle]] (multi-paso)
- Utilizado por: [[Servicio casino]] (`crashStart`/`crashCashout`), [[Componente Casino Crash]]
- Produce: [[Modelo CasinoBet]] (game="crash")
- Relacionado con: [[Casino Map]]
