---
id: modryva-ai-codigos-acceso
title: Códigos de Acceso IA
type: feature
domain: ai
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - ai
aliases:
  - requireAiAccess
  - aicode
  - aipack
created: 2026-07-12
updated: 2026-07-12
---

# Códigos de Acceso IA

## Qué hace
Segunda puerta, por chat/usuario, encima del interruptor global `AI_ENABLED`: el uso real de IA (comandos, DM,
mención, invitado, inline) se bloquea en cualquier chat que no haya redimido acceso, para que dejar la IA
encendida no permita a todos los chats drenar la cuota compartida.

- **`requireAiAccess(update)`** concede acceso si el chat tiene grant (código o suscripción de grupo) **o** si el
  usuario que habla tiene un grant personal comprado desde su DM — un grant personal sigue al usuario a
  cualquier chat (`apps/bot/src/bot-update.service.ts:5193-5212`). Comprueba en paralelo
  `aiAccessRepository.hasAccess(chatId)` y `hasUserAccess(userId)`.
- **`/aicode <código>`** → `handleAiCodeRedemption` canjea un código con
  `aiAccessRepository.redeemCode(chatId, code)`; si falla informa "ese código ya se usó" o "código no válido", y
  si va bien indica los días de acceso hasta la fecha de expiración
  (`bot-update.service.ts:5014-5015`, `:5214-5242`).
- **`/aipack [cancelar]`** → `handleAiPackCommand` muestra el estado de la suscripción de pack de IA (Telegram
  Stars) para el ámbito (chat en grupo, personal en DM) y permite cancelar la renovación; la cancelación en
  grupo requiere admin, y la compra en sí solo ocurre desde la Mini App
  (`bot-update.service.ts:5018-5019`, `:5250-5317`). La cancelación también llama a
  `editUserStarSubscription(...)` en Telegram (best-effort).

## Evidencia
- `apps/bot/src/bot-update.service.ts:5193-5317` (acceso, canje, pack).
- Gate en las superficies: `/ai` (`:5040-5043`), modo invitado (`:11753-11766`), IA inline
  (`:11655-11662`, con `MIN_AI_INLINE_CHARS = 12`), DM (`:17750-17753`), mención (`:17880-17883`).
- Mensaje de bloqueo con las tres vías de acceso (código / suscripción de grupo / pack 30 ⭐/mes desde la Mini
  App): `bot-update.service.ts:5209-5211`.
- Los códigos los genera el owner en `/platform` y se canjean con `/aicode` (comentario en `:5183-5186`).

## Estado / cableado
`implemented`. La lógica de acceso vive en `apps/bot` + repositorio (`aiAccessRepository`) y en los modelos de
datos; el módulo `modules/ai/src` no contiene esta feature (solo aporta la tubería de chat). Modelos
relacionados: [[Modelo AiAccessCode]], [[Modelo AiChatAccess]], [[Modelo AiUserAccess]],
[[Modelo AiSubscription]].

## Preguntas abiertas
- La duración concreta del acceso por código, el precio del pack y el ciclo de facturación con Stars dependen
  del repositorio/servicio de acceso y de la Mini App, no verificables desde `modules/ai/src`; el precio
  "30 ⭐/mes" aparece solo como texto de UI (`:5210`).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Comando aipack]], [[Cuotas de IA]], [[Modelo AiAccessCode]], [[Modelo AiSubscription]],
  [[Integración Telegram Stars]]
