---
id: modryva-command-comprar
title: Comando comprar
type: command
domain: casino
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - modules/games/src/casino.ts
tags:
  - modryva
  - command
  - casino
  - payments
aliases:
  - "/comprar"
  - "/tienda"
  - "/shop"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /comprar

## Propósito
Tienda de fichas: compra packs de fichas del casino con **Telegram Stars** (moneda `XTR`). Sin argumento,
lista los packs disponibles.

## Sintaxis
`/comprar` (ver tienda) · `/comprar <pack>` (`s`/`m`/`l`). Aliases `/tienda`, `/shop`
(`modules/games/src/casino.ts:135`). Packs en `CHIP_PACKS` (`casino.ts:99-101`).

## Permisos
Ninguno especial (por usuario). La factura debe llegar a un chat válido; en grupo puede pedir chat privado.

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`), rama `kind === "buy"` (2621). Si el pack
existe, envía factura con `telegramGateway.sendInvoice(...)` (currency `XTR`, payload
`chips:<pack>:<userId>`); el pago se acredita en el flujo de `successful_payment` del casino. Solo diversión,
sin dinero real (fichas virtuales).

## Modelos que toca
[[Modelo ChipWallet]] (al acreditar tras el pago) y el flujo de pagos Stars ([[Modelo Payment]] /
[[Integración Telegram Stars]]).

## Eventos
`sendInvoice` (factura Stars); la acreditación ocurre en el handler de pago exitoso.

## Errores / edge-cases
Pack desconocido → muestra la tienda. "No pude crear la factura" si el Gateway falla. En grupo sin chat
válido: "Abre un chat privado conmigo para comprar".

## Tests
`modules/games/src/casino.ts` + `apps/bot/src/bot-update.service.test.ts` (fixtures de pago).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]], [[Package telegram]]
- Produce: [[Modelo ChipWallet]]
- Relacionado con: [[Comando cartera]], [[Comando aipack]], [[Integración Telegram Stars]], [[Chip Economy]]
