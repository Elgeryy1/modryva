---
id: juego-sicbo
title: Juego SicBo
type: feature
domain: casino
source: [modules/games/src/sicbo.ts, apps/api/src/casino/casino.service.ts, apps/web/components/casino/SicBo.tsx]
status: implemented
maturity: stable
tags: [modryva, feature, casino]
aliases: [sicbo, sic bo]
created: 2026-07-12
updated: 2026-07-12
---

# Juego SicBo

Sic Bo instantáneo: 3 dados (1..6 cada uno), apuesta a la suma o a un triple.

## Lógica pura (`modules/games/src/sicbo.ts`)

- **Tirada**: `rollSicBo(ss,cs,nonce)` (L50-58) — cada dado desde su propio cursor HMAC (0/1/2), independientes con el mismo nonce; `dieFromFloat` mapea a 1..6.
- **Apuestas** (`SicBoBet` L31-34): `small` (suma 4..10), `big` (suma 11..17), `triple value 1..6`.
- **Probabilidades exactas** sobre 216 combos (`SICBO_PROBABILITY` L65-69): small/big `105/216 ≈ 48.61%`, triple `1/216`. Un **triple cualquiera** (3 dados iguales) es el "cero verde": pierde siempre small/big aunque su suma caiga en rango.
- **Multiplicador**: `sicBoPayoutMultiplier = floor((1/p)·(1-edge)·100)/100` (L76-82); `sicBoMultiplier(bet, roll)` L88-112.

## Multiplicador / house edge
Ventaja `CASINO.houseEdge = 2%` vía `(1-edge)`. Small/big ≈ 2.01×; triple específico ≈ 205× (la apuesta más rara/alta).

## Flujo API (instantáneo)
`instantResolver` game=`sicbo` con `parseSicBoBet` (`casino.service.ts:247-256, 303-316`); `detail = { roll, bet }`. Vía `placeBet`. Ver [[Casino Bet Lifecycle]].

## Componente web
`apps/web/components/casino/SicBo.tsx` (4 KB) — selección small/big/triple.

## Relaciones

- Pertenece a: [[Módulo games]]
- Depende de: [[Provably Fair]] (`fairFloat` con cursor por dado), [[Chip Economy]] (`placeBet`)
- Utilizado por: [[Servicio casino]], [[Componente Casino SicBo]]
- Relacionado con: [[Casino Bet Lifecycle]], [[Casino Map]]
