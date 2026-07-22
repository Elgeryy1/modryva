---
id: modryva-integration-telegram-bot-api
title: Integración Telegram Bot API
type: integration
domain: integration
status: implemented
maturity: stable
source:
  - packages/telegram/src
tags:
  - modryva
  - integration
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Integración Telegram Bot API

## Qué es
La API oficial de bots de Telegram: recibir updates y ejecutar acciones (enviar mensajes, banear, dice,
invoices…). Es el canal principal de Modryva.

## Punto de contacto
[[Package telegram]] (gateway) encapsula las llamadas (`callTelegramMethodForResult`, `sendDice`, etc.).
Credencial: [[Env TELEGRAM_BOT_TOKEN]].

## Modos
- Padre `@ModryvaBot`: **long-polling** ([[Poller]], `getUpdates`).
- Bots hijos: **webhook** ([[Webhook de Bots Hijos]] vía [[Cloudflare Tunnel]]).

## Datos que intercambia
Entrada: updates ([[Events Map]]). Salida: mensajes, acciones de moderación, dados nativos (con `value`),
invoices de Stars.

## Fallos y resiliencia
Rate limits 429 (backoff), single-consumer del polling ([[Riesgo Long-polling single-consumer]]).

## Relaciones
- Pertenece a: [[Integrations Map]]
- Utilizado por: [[App bot]], [[Bot Update Service]]
- Relacionado con: [[Integración Telegram Stars]], [[Integración Telegram Mini Apps]]
