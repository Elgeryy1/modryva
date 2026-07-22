---
id: modryva-command-tragaperras
title: Comando tragaperras
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
  - "/tragaperras"
  - "/slot"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /tragaperras

## Propósito
Tragaperras con apuesta usando el **slot nativo animado de Telegram** (🎰). El resultado lo genera Telegram,
así que es provably-fair por construcción.

## Sintaxis
`/tragaperras <apuesta>` (alias `/slot`; ej. `/tragaperras 100`). Nombres en
`modules/games/src/casino.ts:122`; usage `casino.ts:157`.

## Permisos
Ninguno especial (por usuario). No requiere bot admin, pero el bot debe poder enviar dados en el chat.

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`), rama `kind === "slot"` (2653) → delega en
`settleNativeBet(context, update, stake, "🎰", 1, ...)` (2770): debita, envía el dado real, lo lee, aplica
`resolveSlot` y acredita; ante fallo del dado **reembolsa** la apuesta.

## Modelos que toca
[[Modelo ChipWallet]] + ledger (`debit`/`credit` con `betId`).

## Eventos
Ledger de fichas (debit → win/refund).

## Errores / edge-cases
"Fichas insuficientes". Si la animación falla: "Apuesta reembolsada". Apuesta fuera de rango: límites min/max.

## Tests
`modules/games/src/casino.ts` (`resolveSlot`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]], [[Package telegram]]
- Produce: [[Modelo ChipWallet]]
- Relacionado con: [[Comando dado]], [[Comando mm]], [[Comando diana]], [[Casino Map]]
