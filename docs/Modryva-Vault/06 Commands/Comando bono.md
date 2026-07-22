---
id: modryva-command-bono
title: Comando bono
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
  - "/bono"
  - "/daily"
  - "/diario"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /bono

## Propósito
Reclama el bono diario de fichas del casino (`CASINO.dailyBonus` = 500). Una vez por día natural.

## Sintaxis
`/bono` (alias `/daily`, `/diario`). Aliases nativos en `modules/games/src/casino.ts:118`.

## Permisos
Ninguno especial (por usuario). No requiere bot admin.

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`), rama `kind === "daily"` (2504). Usa
`chipRepository.claimDaily(tenantId, userId, day, CASINO.dailyBonus)` con `day` = fecha ISO (YYYY-MM-DD),
que garantiza un único cobro por día.

## Modelos que toca
[[Modelo ChipWallet]] (saldo) y el registro de reclamo diario del `chipRepository`.

## Eventos
Ninguno explícito (`recordAudit`); el ledger de fichas registra el movimiento.

## Errores / edge-cases
"⏳ Ya reclamaste tu bono hoy" si ya se cobró en el día. Sin `userId` devuelve `null`.

## Tests
`modules/games/src/casino.ts` (tests) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]]
- Produce: [[Modelo ChipWallet]]
- Relacionado con: [[Comando cartera]], [[Comando dado]], [[Chip Economy]]
