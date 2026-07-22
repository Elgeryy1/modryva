---
id: modryva-command-mm
title: Comando mm
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
  - "/mm"
  - "/overunder"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /mm

## Propósito
Juego "Over/Under" (más/menos que siete) con dos dados nativos de Telegram: apuestas a `bajo`, `siete` o
`alto` sobre la suma de dos dados.

## Sintaxis
`/mm <apuesta> <bajo|siete|alto>` (alias `/overunder`). Nombres en `modules/games/src/casino.ts:123`.

## Permisos
Ninguno especial (por usuario). No requiere bot admin, pero el bot debe poder enviar dados.

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`), rama `kind === "overunder"` (2666) →
`settleNativeBet(context, update, stake, "🎲", 2, ...)` con `resolveOverUnder(v0, v1, pick)` (dos tiradas).
Debita, lanza los dados reales, prizea y acredita; reembolsa ante fallo.

## Modelos que toca
[[Modelo ChipWallet]] + ledger.

## Eventos
Ledger de fichas (debit → win/refund).

## Errores / edge-cases
"Fichas insuficientes"; apuesta fuera de rango. Fallo de dado → reembolso.

## Tests
`modules/games/src/casino.ts` (`resolveOverUnder`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]], [[Package telegram]]
- Produce: [[Modelo ChipWallet]]
- Relacionado con: [[Comando tragaperras]], [[Comando diana]], [[Casino Map]]
