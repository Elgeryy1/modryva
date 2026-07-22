---
id: modryva-flujo-compra-stars
title: Flujo Compra con Stars
type: flow
domain: payments
status: implemented
maturity: stable
source:
  - modules/payments/src
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - flow
  - payments
aliases:
  - Flujo de pago
  - Comprar con Telegram Stars
created: 2026-07-12
updated: 2026-07-12
---

# Flujo — compra con Telegram Stars

Cómo un usuario paga con **Telegram Stars** (⭐) y qué recibe (fichas de casino o acceso a IA). Usa el flujo
de pagos nativo de Telegram (invoice → pre-checkout → successful payment).

## Disparador
El usuario abre una compra: [[Comando comprar]] (packs de fichas del casino) o el flujo de acceso IA
([[Comando aipack]] / endpoint `POST v1/miniapp/groups/:gid/ai-pack/invoice`).

## Pasos
1. **Invoice**: el bot/API emite una factura de Telegram Stars por el producto elegido ([[Modelo Product]] /
   [[Modelo Invoice]]).
2. **Pre-checkout**: Telegram pregunta al bot si acepta el pago → [[Evento pre_checkout_query]]. El bot
   valida (producto válido, importe) y **responde OK** dentro del tiempo límite (si no, Telegram cancela).
3. **Pago**: el usuario paga en el cliente de Telegram.
4. **Confirmación**: llega [[Evento successful_payment]] → el bot registra el pago ([[Modelo Payment]]) de
   forma **idempotente** ([[Idempotencia]], `charge_id`) para no acreditar dos veces.
5. **Entrega del valor**:
   - **Fichas**: se acreditan al [[Modelo ChipWallet|monedero de fichas]] vía [[Chip Economy]]
     ([[Modelo ChipLedger]]) — sin romper el guardarraíl de fichas no canjeables
     ([[ADR-005 Fichas virtuales no canjeables (guardrail legal)]]).
   - **Acceso IA**: se concede el [[Modelo Entitlement|entitlement]]/acceso correspondiente.

## Ramas y fallos
- **Pre-checkout rechazado** (producto inválido) → Telegram cancela, no se cobra.
- **successful_payment duplicado / reintento** → la idempotencia evita doble acreditación.
- **Entrega falla tras cobro** → debe quedar registrado el pago para reconciliar (evitar cobro sin valor).

## Guardarraíl
Stars compra **fichas virtuales / acceso**, nunca dinero retirable. Es la única entrada de valor real, y va
en un solo sentido ([[ADR-005 Fichas virtuales no canjeables (guardrail legal)]]).

## Preguntas abiertas
- Reembolsos/disputas de Stars y su efecto en fichas ya gastadas: `unknown`.
- Detalle exacto de la clave de idempotencia del pago: `unknown` (confirmar en `modules/payments/src`).

## Relaciones
- Pertenece a: [[Workflows Map]]
- Disparado por: [[Comando comprar]], [[Comando aipack]]
- Depende de: [[Evento pre_checkout_query]], [[Evento successful_payment]], [[Modelo Payment]]
- Relacionado con: [[Integración Telegram Stars]], [[Chip Economy]], [[Modelo Entitlement]]
