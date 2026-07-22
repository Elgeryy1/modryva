---
id: quiet-mode
title: Quiet Mode
type: feature
domain: community
status: implemented
maturity: beta
source: [packages/shared/src/miniapp-contracts.ts, apps/bot/src/bot-update.service.ts, apps/api/src/miniapp/config.controller.ts, apps/worker/src/recap-processor.ts]
tags: [modryva, feature, community]
aliases: [modo silencio, chat_quiet, silencio]
created: 2026-07-12
updated: 2026-07-12
---

# Quiet Mode

Gate universal: cuando un admin activa el "modo silencio", el bot **no habla sin que se lo pidan**. Es el interruptor que todos los mensajes proactivos consultan antes de publicar.

## Clave y almacenamiento

Es una `ChatSetting` con clave `chat_quiet` (`CHAT_QUIET_KEY`, `packages/shared/src/miniapp-contracts.ts:190`) y valor `{ enabled: boolean }`. No añade tabla nueva: reutiliza [[Modelo ChatSetting]].

## Toggle desde el Mini App

`GET/PUT groups/:gid/quiet` (`apps/api/src/miniapp/config.controller.ts:284-327`), validado con `chatQuietSchema`. El cambio se audita como `miniapp.quiet.updated` (`config.controller.ts:314-325`).

## Lectura en el bot

`isChatQuiet(tenantId, chatId)` (`apps/bot/src/bot-update.service.ts:10520-10534`) lee `chat_quiet` y devuelve `true` solo si `enabled === true`. Lo consultan los mensajes no pedidos: p. ej. el "watchdog" de moderación no-admin, que si no puede borrar avisaría al grupo, **pero calla si el bot está silenciado** (`deleteOrWatch`, `bot-update.service.ts:10552-10579`), y los anuncios de subida de nivel.

## Gate en el worker

El [[Recap Semanal]], al ser un post no pedido, también consulta `chat_quiet` antes de publicar y se salta el grupo si está activo (`apps/worker/src/recap-processor.ts:47-50,273-282`).

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo ChatSetting]]
- **Utilizado por**: [[Recap Semanal]], moderación no-admin (watchdog), anuncios de nivel
- **Relacionado con**: [[Settings Panel]], [[Database Map]]
