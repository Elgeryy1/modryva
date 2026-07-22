---
id: juego-blackjack
title: Juego Blackjack
type: feature
domain: casino
source: [modules/games/src/blackjack.ts, apps/api/src/casino/casino.service.ts, apps/web/components/casino/Blackjack.tsx]
status: implemented
maturity: stable
tags: [modryva, feature, casino]
aliases: [blackjack, 21]
created: 2026-07-12
updated: 2026-07-12
---

# Juego Blackjack

Blackjack multi-paso de la Mini App: pides (hit) o plantas (stand) contra el crupier.

## Lógica pura (`modules/games/src/blackjack.ts`)

Solo helpers puros; la API conduce el bucle hit/stand. Cada carta deriva de `fairShuffle`, así toda la mano es verificable.

- `DEFAULT_DECKS = 6` (L38); `buildShoe` construye 6 mazos (4 de cada rango 1..13) y aplica la permutación fair (L86-108).
- `handValue(cards)` (L59-74): as = 11, se degrada a 1 si revienta; `soft` si algún as sigue contando 11. J/Q/K = 10.
- `isBlackjack` = 2 cartas suman 21 (L77-78).
- `dealerPlays(shoe, startIndex, dealerCards)` (L118-139): el crupier pide hasta ≥17 y **se planta en soft 17 (S17)**; la decisión se toma sobre la mano COMPLETA.
- `settleBlackjack(playerTotal, dealerTotal, playerBlackjack)` (L152-173): blackjack natural 2.5× (3:2), win 2×, push 1×, lose 0×. Bust del jugador siempre pierde.

## Multiplicador / house edge
Ventaja estructural (~0.5% con estrategia perfecta bajo 6 mazos, S17, BJ 3:2), no un multiplicador ajustable: el jugador actúa primero y sus busts son pérdida total.

## Flujo API (multi-paso)
- `blackjackStart` (`casino.service.ts:580-614`): reparte `player=[shoe0,shoe2]`, `dealer=[shoe1,shoe3]`, cursor 4; si el jugador tiene 21 natural, liquida directo.
- `blackjackAction` (L616-665): `hit` añade carta y si `>21` liquida como pérdida; `stand` → `blackjackSettle`.
- `blackjackSettle` (L667-716): **siembra al crupier con sus 2 cartas iniciales** antes de `dealerPlays` — comentario L680-683 marca que sin esto el crupier robaba sobre mano vacía y reventaba casi siempre ("house-breaking bug"). Natural-vs-natural = push, no 2.5× (L689-696).

## Componente web y estado
`apps/web/components/casino/Blackjack.tsx` (15.5 KB) — el mayor de los juegos. Muestra mano del jugador, carta visible del crupier (`dealerUp`), total; botones hit/stand. El front lee `playerTotal`/`dealerTotal` para la etiqueta de resultado (campos añadidos tras un bug de "? vs ?", ver [[Casino Bug Audit 2026-07]]).

## Relaciones

- Pertenece a: [[Módulo games]]
- Depende de: [[Provably Fair]] (`fairShuffle`), [[Casino Bet Lifecycle]] (multi-paso)
- Utilizado por: [[Servicio casino]], [[Componente Casino Blackjack]]
- Produce: [[Modelo CasinoBet]] (game="blackjack")
- Relacionado con: [[Casino Map]]
