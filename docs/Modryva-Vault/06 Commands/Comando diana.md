---
id: modryva-command-diana
title: Comando diana
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
  - "/diana"
  - "/dardos"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /diana

## Propósito
Juego de dardos con apuesta usando el dado nativo de diana (🎯) de Telegram: apuestas a `fuera`, `aro` o
`diana` y cobras según dónde caiga.

## Sintaxis
`/diana <apuesta> <fuera|aro|diana>` (alias `/dardos`). Nombres en `modules/games/src/casino.ts:124`;
usage `casino.ts:161`.

## Permisos
Ninguno especial (por usuario). No requiere bot admin, pero el bot debe poder enviar dados.

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`), rama `kind === "bullseye"` (2677) →
`settleNativeBet(context, update, stake, "🎯", 1, ...)` con `resolveBullseye(v0, tier)`. Debita, lanza el
dardo real, prizea y acredita; reembolsa ante fallo. Lógica del multiplicador en
`modules/games/src/bullseye.ts`.

## Modelos que toca
[[Modelo ChipWallet]] + ledger.

## Eventos
Ledger de fichas (debit → win/refund).

## Errores / edge-cases
"Fichas insuficientes"; tier inválido devuelve el `usage`. Fallo de dado → reembolso.

## Tests
`modules/games/src/bullseye.ts` (`resolveBullseye`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]], [[Package telegram]]
- Produce: [[Modelo ChipWallet]]
- Relacionado con: [[Comando tragaperras]], [[Comando mm]], [[Casino Map]]
