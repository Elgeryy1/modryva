---
id: juego-ruleta
title: Juego Ruleta
type: feature
domain: casino
source: [modules/games/src/roulette.ts, apps/api/src/casino/casino.service.ts, apps/web/components/casino/Roulette.tsx]
status: implemented
maturity: stable
tags: [modryva, feature, casino]
aliases: [ruleta, roulette]
created: 2026-07-12
updated: 2026-07-12
---

# Juego Ruleta

Ruleta europea de **cero único** (casillas 0..36), juego instantáneo de la Mini App.

## Lógica pura (`modules/games/src/roulette.ts`)

- **Giro**: `spinRoulette(ss,cs,nonce) = fairInt(...,0,36)` (L37-41).
- **Tipos de apuesta** (`RouletteBet` L28-31): `straight` (pleno), `red/black/odd/even/low/high` (fuera), `dozen/column index 1|2|3`.
- **Multiplicadores** (`rouletteMultiplier` L54-96), INCLUYEN el stake: straight 36×, rojo/negro/par/impar/bajo/alto 2×, docena/columna 3×. La casilla 0 (verde) **pierde toda apuesta externa** y solo paga un pleno al 0.
- `RED_NUMBERS` L23-25.

## Multiplicador / house edge
La rueda tiene 37 casillas pero se paga como si hubiera 36: pleno 36× sobre 1/37 ⇒ retorno `36/37 ≈ 0.97297`, **ventaja de casa exacta 1/37 ≈ 2.70%** (la europea estándar), igual en toda apuesta externa por el cero verde.

## Flujo API (instantáneo)
`instantResolver` game=`roulette` con `parseRouletteBet` (`casino.service.ts:237-246, 318-338`); `detail = { pocket, bet }`. Vía `placeBet`. Ver [[Casino Bet Lifecycle]].

## Componente web
`apps/web/components/casino/Roulette.tsx` (9.5 KB) — selección de apuesta (pleno/color/docena/columna) y animación de rueda. `BetControls` compartido + `onResult`.

## Nota de auditoría
El saldo de ruleta fue un punto arreglado (ver [[Casino Bug Audit 2026-07]]).

## Relaciones

- Pertenece a: [[Módulo games]]
- Depende de: [[Provably Fair]] (`fairInt`), [[Chip Economy]] (`placeBet`)
- Utilizado por: [[Servicio casino]], [[Componente Casino Roulette]]
- Relacionado con: [[Casino Bet Lifecycle]], [[Casino Map]]
