---
id: modryva-command-regalar
title: Comando regalar
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
  - "/regalar"
  - "/regalo"
  - "/gift"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /regalar

## Propósito
Transfiere fichas del casino a otra persona (regalo P2P). Se usa respondiendo al mensaje de quien recibe.

## Sintaxis
Responde al mensaje de alguien con `/regalar <cantidad>` (aliases `/regalo`, `/gift`;
`modules/games/src/casino.ts:133`).

## Permisos
Ninguno especial (por usuario). No requiere bot admin. No puedes regalarte a ti mismo
(`bot-update.service.ts:2607`).

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`), rama `kind === "gift"` (~2596). Requiere
un mensaje respondido para identificar al receptor; mueve fichas de emisor a receptor por el `chipRepository`.

## Modelos que toca
[[Modelo ChipWallet]] de ambos usuarios (débito emisor + crédito receptor).

## Eventos
Ledger de fichas (transferencia).

## Errores / edge-cases
"Responde al mensaje de la persona a la que quieres regalar fichas" sin reply; "No puedes regalarte fichas a
ti mismo"; saldo insuficiente.

## Tests
`modules/games/src/casino.ts` + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]]
- Produce: [[Modelo ChipWallet]]
- Relacionado con: [[Comando cartera]], [[Comando comprar]], [[Chip Economy]]
