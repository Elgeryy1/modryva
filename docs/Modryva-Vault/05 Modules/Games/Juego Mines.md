---
id: juego-mines
title: Juego Mines
type: feature
domain: casino
source: [modules/games/src/mines.ts, apps/api/src/casino/casino.service.ts, apps/web/components/casino/Mines.tsx]
status: implemented
maturity: stable
tags: [modryva, feature, casino]
aliases: [mines, minas, buscaminas]
created: 2026-07-12
updated: 2026-07-12
---

# Juego Mines

Buscaminas-con-apuesta multi-paso en cuadrícula 5×5 (25 casillas): destapa sin tocar minas y retira antes de reventar.

## Lógica pura (`modules/games/src/mines.ts`)

- `MINES_TILES = 25`, `DEFAULT_HOUSE_EDGE = 0.03` (L25-26).
- **Layout provably-fair**: `minesLayout(ss,cs,nonce,mineCount)` (L36-52) hace `fairShuffle` de las 25 casillas, toma las primeras `mineCount` (clamp `[1,24]`) y las ordena. Todo el tablero deriva de una sola permutación verificable.
- **Multiplicador**: `minesMultiplier(mineCount, revealed, edge=0.03)` (L60-80). El justo tras `revealed` picks seguros es `Π (25-i)/(25-mines-i) = 1/P(sobrevivir)`; se escala por `(1-edge)` y se trunca a 2 decimales hacia abajo (`floor2`) para que el redondeo nunca favorezca al jugador. Con `revealed=0` el multiplicador es `(1-edge)`.
- `isMine(layout, tile)` L83-85.

## Multiplicador / house edge
EV de pago = `0.97×` stake (3% de ventaja) aplicada UNA vez al multiplicador final. Sube con `revealed` **y** con `mineCount`.

## Flujo API (multi-paso)

- `minesStart` (`casino.service.ts:415-442`): valida `mineCount` 1..24, guarda `{ layout, mineCount, revealed: [] }` en el [[Modelo CasinoBet]].
- `minesReveal` (L474-545): rechaza casilla ya descubierta; si es mina → `settleCasinoBet` con payout 0 + `reveal` del serverSeed + devuelve el `layout`; si es segura y quedan más → `updateCasinoBetState`.
- **Auto-cashout** al limpiar el tablero (L511-534): cuando se descubre la última casilla segura, el servidor auto-liquida al máximo (una casilla más detonaría y perdería todo).
- `minesCashout` (L547-577): exige ≥1 casilla descubierta, liquida al multiplicador actual.

## Componente web y estado (`apps/web/components/casino/Mines.tsx`)

- Estado: `stake`, `mineCount` (def. 3), `betId`, `revealed` (mapa casilla→"safe"|"mine"), `mult`, `shownMult` (tween), `boom`, `err`.
- Animaciones: flip 3D por reveal (Web Animations API), pop de gema con glow verde, explosión escalonada de minas + shake del tablero; respetan `prefers-reduced-motion`.
- **Reentrancy**: refs `starting`/`revealing`/`settling` — `revealing` serializa reveals para que el cliente no dispare dos `minesReveal` concurrentes que compitan por el `state` del servidor (L52-55). `betIdRef` para liquidar en unmount.

## Relaciones

- Pertenece a: [[Módulo games]]
- Depende de: [[Provably Fair]] (`fairShuffle`), [[Casino Bet Lifecycle]] (multi-paso)
- Utilizado por: [[Servicio casino]], [[Componente Casino Mines]]
- Produce: [[Modelo CasinoBet]] (game="mines")
- Relacionado con: [[Casino Map]]
