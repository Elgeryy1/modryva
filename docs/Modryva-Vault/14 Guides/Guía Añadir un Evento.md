---
id: modryva-guia-anadir-evento
title: Guía Añadir un Evento
type: guide
domain: developer
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - packages/telegram/src
tags:
  - modryva
  - guide
  - developer
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Guía — manejar un nuevo tipo de update/evento de Telegram

Telegram entrega distintos tipos de `Update`. Modryva ya maneja [[Evento message]],
[[Evento callback_query]], [[Evento chat_member]], [[Evento my_chat_member]], [[Evento chat_join_request]],
[[Evento pre_checkout_query]] y [[Evento successful_payment]] (ver [[Events Map]]). Añadir soporte a uno
nuevo (o a un subtipo) sigue el [[Flujo Update de Telegram]].

## Pasos
1. **Normaliza el update**: en `packages/telegram/src` se parsea el `Update` crudo a un envelope tipado
   (`TelegramUpdateEnvelope`) con un `kind`. Si el subtipo no está mapeado, añádelo aquí primero.
2. **Clasifica y enruta**: en `apps/bot/src/bot-update.service.ts` el dispatcher decide por `update.kind`.
   Añade tu handler a la cadena `botHandlers()` (`bot-update.service.ts:1096`+) o extiende el clasificador
   existente. Recuerda: devuelve `BotReply | null` (`null` = pasa al siguiente).
3. **Efectos**: responde vía [[Integración Telegram Bot API]] y/o escribe en [[Package data]]; registra
   auditoría cuando aplique.

## Consideraciones
- **Mensajes no pedidos**: si tu handler envía un mensaje que el usuario no pidió, respeta el **modo
  silencio** (`isChatQuiet`) — es el gate universal de mensajes no solicitados.
- **Permisos del bot**: si la reacción requiere que el bot sea admin (borrar, restringir), decide si avisas
  o te callas (patrón `botConfirmedNotAdmin` / `deleteOrWatch`).
- **Single-consumer**: una excepción no tratada puede frenar el consumo ([[Riesgo Long-polling single-consumer]]);
  maneja errores dentro del handler.

## Checklist
- [ ] Envelope tipado en `packages/telegram` (si es subtipo nuevo).
- [ ] Handler en el dispatcher.
- [ ] Respeta modo silencio y permisos.
- [ ] Nota en el Vault: `Evento <x>` o `Flujo <x>` (ver [[Conventions]]).

## Relaciones
- Pertenece a: [[Developer Onboarding Map]]
- Depende de: [[Package telegram]], [[Bot Update Service]]
- Relacionado con: [[Events Map]], [[Flujo Update de Telegram]], [[Guía Añadir un Comando]]
