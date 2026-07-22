---
id: modryva-adr-005
title: ADR-005 Fichas virtuales no canjeables (guardrail legal)
type: decision
domain: decision
status: inferred
maturity: stable
source:
  - packages/data/src/chip-repository.ts
  - modules/games/src/casino.ts
tags:
  - modryva
  - decision
  - casino
created: 2026-07-12
updated: 2026-07-12
---

# ADR-005 — Fichas virtuales no canjeables (guardrail legal)

## Estado
**inferred** (decisión deducida del diseño del código; no hay ADR explícito en el repo, pero el guardrail
es evidente y deliberado).

## Contexto
El casino social maneja "fichas" que se ganan/pierden en juegos de azar. Permitir convertirlas en dinero
real las convertiría en juego con dinero real (regulado, y fuera de los ToS de Telegram para bots).

## Decisión
Las fichas son **virtuales y NO canjeables**: no existe ninguna operación de cash-out. El conjunto de
razones de movimiento de saldo (`CHIP_REASONS`) es un **union de TypeScript cerrado** sin `withdraw`/
`cashout`; el compilador impide añadir un flujo de retirada sin tocar el tipo. La monetización es solo de
entrada (compra de packs con Telegram Stars, cosméticos).

## Evidencia en el repositorio
`packages/data/src/chip-repository.ts` (débito atómico condicional + `CHIP_REASONS` cerrado, con test que
lo fija) y `modules/games/src/casino.ts` (constantes de economía). Ver [[Chip Economy]] y
[[Modelo ChipLedger]].

## Alternativas
- Permitir retiro con KYC/licencia (coste legal y operativo alto; fuera de alcance).
- Economía puramente cosmética sin azar (menor engagement).

## Consecuencias positivas
Línea legal clara, dentro de ToS de Telegram; el guardrail lo refuerza el propio tipo (no depende de
disciplina del desarrollador).

## Consecuencias negativas
Limita modelos de monetización basados en premios reales; requiere comunicar bien que las fichas no tienen
valor monetario.

## Componentes afectados
[[Chip Economy]] · [[Modelo ChipWallet]] · [[Modelo ChipLedger]] · [[Casino Map]] · [[Integración Telegram Stars]]

## Relaciones
- Pertenece a: [[Decisions Map]]
- Relacionado con: [[Chip Economy]], [[Casino Map]]
