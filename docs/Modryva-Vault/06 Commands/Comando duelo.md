---
id: modryva-command-duelo
title: Comando duelo
type: command
domain: casino
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - modules/games/src/casino.ts
tags:
  - modryva
  - command
  - casino
aliases:
  - "/duelo"
  - "/duel"
  - "/reto"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /duelo

## Propósito
Reto PvP de dados por fichas: quien tira el dado más alto se lleva el bote. Se acepta/cancela por botón.

## Sintaxis
`/duelo <apuesta>` (ej. `/duelo 200`). Aliases `/duel`, `/reto` (`modules/games/src/casino.ts:125`;
usage `casino.ts:163`). Solo en grupos.

## Permisos
Ninguno especial (por usuario). No requiere bot admin. Apuesta entre `CASINO.minBet` y `CASINO.maxBet`.

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`), rama `kind === "duel"` (2684). Abre el
duelo con `chipRepository.openDuel(...)` y publica botones `duel:accept:<id>` / `duel:cancel:<id>`. La
aceptación/cancelación la resuelve `handleDuelCallback` (2853): reclama, tira ambos dados y liquida (o
reembolsa al cancelar).

## Modelos que toca
[[Modelo ChipWallet]] + registro de duelo del `chipRepository` (bote retenido hasta resolver).

## Eventos
Ledger de fichas (retención + liquidación/reembolso).

## Errores / edge-cases
"Los duelos son para grupos" en privado. "Fichas insuficientes para el duelo" si no cubre la apuesta.

## Tests
`modules/games/src/casino.ts` + `apps/bot/src/bot-update.service.test.ts` (`handleDuelCallback`).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]]
- Produce: [[Modelo ChipWallet]]
- Relacionado con: [[Comando dado]], [[Comando casino]], [[Casino Map]]
