---
id: juego-keno
title: Juego Keno
type: feature
domain: casino
source: [modules/games/src/keno.ts, apps/api/src/casino/casino.service.ts, apps/web/components/casino/Keno.tsx]
status: implemented
maturity: stable
tags: [modryva, feature, casino]
aliases: [keno]
created: 2026-07-12
updated: 2026-07-12
---

# Juego Keno

Keno simplificado instantáneo: el jugador elige **exactamente 3** números de 1..20; la casa sortea 5.

## Lógica pura (`modules/games/src/keno.ts`)

- Constantes: `KENO_RANGE 20`, `KENO_DRAWN_COUNT 5`, `KENO_PICK_COUNT 3`, `KENO_WIN_THRESHOLD 2` (L41-43, 67). Conteo fijo de 3 para mantener tratable la combinatoria (un keno real deja elegir 1-10 de 1-80).
- **Sorteo sin repetición**: `drawKeno(ss,cs,nonce)` = primeros 5 de `fairShuffle(...,20)` mapeados +1 (L107-114).
- **Probabilidad hipergeométrica exacta** de acertar k de 3: `P(k) = C(3,k)·C(17,5-k)/C(20,5)`, con `C(20,5)=15504` (¡las 5 sorteadas cuentan!). P(0)≈0.399, P(1)≈0.461, P(2)≈0.132, P(3)≈0.00877 (L18-27).
- **Paytable**: se gana con 2 o 3 aciertos; 0 o 1 pierden (0). El presupuesto EV `(1-houseEdge)` se reparte a partes iguales entre niveles ganadores, cada uno tasado por su probabilidad: `mult(k) = floor((1-edge)/(niveles·P(k)))`. `kenoMultiplier(picks, drawn)` L121-126; `KENO_PAYTABLE` L95-100.

## Multiplicador / house edge
House edge **global** (ponderado por P real) ≈ **2%** (`CASINO.houseEdge`). Acertar los 3 (~0.88%) paga el gordo (~55×); 2 aciertos ~3.7×.

## Flujo API (instantáneo)
`instantResolver` game=`keno` (`casino.service.ts:271-288`): valida 3 picks únicos en 1..20; `detail = { picks, drawn }`. Vía `placeBet`. Ver [[Casino Bet Lifecycle]].

## Componente web
`apps/web/components/casino/Keno.tsx` (4.6 KB) — grilla de 20 números para elegir 3.

## Nota de auditoría
La clasificación de economía de Keno fue arreglada en la auditoría (ver [[Casino Bug Audit 2026-07]]).

## Relaciones

- Pertenece a: [[Módulo games]]
- Depende de: [[Provably Fair]] (`fairShuffle`), [[Chip Economy]] (`placeBet`)
- Utilizado por: [[Servicio casino]], [[Componente Casino Keno]]
- Relacionado con: [[Casino Bet Lifecycle]], [[Casino Map]]
