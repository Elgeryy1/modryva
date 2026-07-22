---
id: juego-plinko
title: Juego Plinko
type: feature
domain: casino
source: [modules/games/src/plinko.ts, apps/api/src/casino/casino.service.ts, apps/web/components/casino/Plinko.tsx]
status: implemented
maturity: stable
tags: [modryva, feature, casino]
aliases: [plinko]
created: 2026-07-12
updated: 2026-07-12
---

# Juego Plinko

Juego **instantáneo** de la Mini App: una bola cae por filas de pegs, rebota izquierda/derecha y aterriza en una ranura con multiplicador.

## Lógica pura (`modules/games/src/plinko.ts`)

- **Caída provably-fair**: para cada fila `r`, el rebote se decide por `fairFloat(ss,cs,nonce,r) < 0.5` → "L" / "R" (`cursor=r` da una extracción independiente por fila con el MISMO nonce). La ranura = número de rebotes "R" (0..rows). `resolvePlinko` `plinko.ts:83-110`.
- **Riesgo y filas**: `PlinkoRisk = bajo|medio|alto`, `PlinkoRows = 8|12|16`.
- **Tablas de pago**: `PLINKO_PAYOUTS[risk][rows]` (`plinko.ts:45-73`), simétricas (`payout[s] === payout[rows-s]`), con multiplicadores altos en los bordes (raros) y sub-1× en el centro (común). Ranura inexistente ⇒ 0.

## Multiplicador / house edge
La distribución de ranura es Binomial(rows, 1/2). Ventajas verificadas `1 − E[mult]` (`plinko.ts:16-20`):

| | rows=8 | rows=12 | rows=16 |
|---|---|---|---|
| bajo | 4.45% | 3.25% | 3.53% |
| medio | 4.77% | 4.25% | 4.99% |
| alto | 4.22% | 3.37% | 4.79% |

Ejemplo extremo: `alto/16` borde paga **852.8×**; centro paga 0.4×.

## Flujo API (instantáneo)
`instantResolver` game=`plinko` (`casino.service.ts:226-236`): risk por defecto `bajo`, rows por defecto `12`. `detail = { path, slot }`. Va por `placeBet` (una sola transacción). Ver [[Casino Bet Lifecycle]].

## Componente web
`apps/web/components/casino/Plinko.tsx` (11 KB) — selección de riesgo/filas y animación de la bola. Estado local de apuesta vía `BetControls` compartido; resultado reportado con `onResult` ([[Componente Casino shared]]).

## Relaciones

- Pertenece a: [[Módulo games]]
- Depende de: [[Provably Fair]] (`fairFloat` por fila), [[Chip Economy]] (`placeBet`)
- Utilizado por: [[Servicio casino]], [[Componente Casino Plinko]]
- Relacionado con: [[Casino Bet Lifecycle]], [[Casino Map]]
