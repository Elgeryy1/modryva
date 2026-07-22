---
id: modryva-casino-bug-audit-2026-07
title: Casino Bug Audit 2026-07
type: reference
domain: testing
status: implemented
maturity: stable
source:
  - apps/web/components/casino
  - apps/web/lib/api.ts
tags:
  - modryva
  - testing
  - casino
aliases:
  - Auditoría de bugs del casino
created: 2026-07-12
updated: 2026-07-12
---

# Casino Bug Audit 2026-07

## Qué fue
Auditoría (10 agentes) de la superficie de casino en la Mini App que encontró **21 bugs**; todos corregidos
y desplegados. Sirve de referencia de las **clases de fallo** a vigilar en juegos de apuesta con estado.

## Clases de bug encontradas
- **Timing / reentrancy**: dobles arranques o dobles cobros por pulsar rápido; se blindó con refs de estado
  (`starting`/`revealing`/`settling`) y guardas de idempotencia por `betId`.
- **Clasificación de resultado**: victorias/empates mostrados como pérdida; se añadió el resultado
  **neutral** (aviso sin ±importe) en `shared.tsx` (`GameResult.neutral`).
- **Pérdida fantasma**: apuestas que restaban saldo sin resolver; auto-cashout/settle al desmontar.
- **Apuesta huérfana**: partida iniciada y no liquidada; liquidación en `unmount` con el `betId` guardado.
- **Saldo desincronizado**: el arranque no devolvía balance; `minesStart` pasó a devolver `balance` y
  `minesReveal` a exponer `cleared?`.

## Corrección representativa (build)
`next build` falló en `Mines.tsx` porque `multiplier: number | undefined` no encaja en `multiplier?: number`
bajo `exactOptionalPropertyTypes` → se fijó con `const clearedMult = r.multiplier ?? 1;`.
Lección transversal: [[Riesgo Build web más estricto que typecheck local]] (el `tsc` incremental local pasó
en falso por `.tsbuildinfo` obsoleto).

## Componentes tocados
`Mines`, `Crash`, `Blackjack`, `Dice`, `Plinko`, `Roulette`, `HiLo`, `SicBo`, `Baccarat`, `Keno` +
`shared.tsx`, `lib/api.ts` (`CASINO_ERROR_ES` / `casinoErrorLabel`), `globals.css` (`.result-notice`).

## Relaciones
- Pertenece a: [[Testing Map]]
- Relacionado con: [[Casino Map]], [[Casino Map]], [[Riesgo Build web más estricto que typecheck local]], [[ADR-005 Fichas virtuales no canjeables (guardrail legal)]]
