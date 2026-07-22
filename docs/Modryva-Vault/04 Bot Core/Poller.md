---
id: poller
title: Poller
type: component
domain: botcore
status: implemented
maturity: stable
source:
  - apps/bot/src/poller.ts
  - apps/bot/src/index.ts
  - docker-compose.yml
tags:
  - modryva
  - component
  - botcore
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Poller

`apps/bot/src/poller.ts` es el **long-polling** del bot: el modo real de ejecución en el despliegue actual
(`docker-compose.yml` fija `BOT_MODE=polling`). Es el fallback para entornos sin webhook público, pero
alimenta la **misma** pipeline que el webhook.

## `startPolling(updates, env, logger)`

`apps/bot/src/index.ts` lo lanza fire-and-forget cuando `BOT_MODE === "polling"`. El flujo (`:620`):

1. Aborta si no hay `TELEGRAM_BOT_TOKEN`.
2. `deleteWebhook?drop_pending_updates=true` — libera `getUpdates` y descarta el backlog.
3. **`syncMenuButton`** — apunta el botón de menú por defecto a la Mini App viva (`readAppUrl`, ver
   [[Runtime URL]]) y lo re-fija cada tick si la URL cambia (auto-cura túneles rotados, sin reinicio).
4. **`setMyCommands`** — publica los comandos en el menú "/" de Telegram. `BOT_COMMANDS` tiene ~150
   entradas, pero Telegram limita a **100 por scope**, así que se envían solo las primeras 100
   (`:664-673`); el resto de comandos siguen funcionando escritos a mano.
5. Bucle infinito: `getUpdates?timeout=25&offset=<n>&allowed_updates=<ALLOWED_UPDATES>`; por cada update
   avanza el `offset` y lo pasa por **`updates.processWebhook(env.TELEGRAM_BOT_USERNAME, update)`** — la
   misma entrada que el webhook, garantizando idempotencia/auditoría idénticas (`:692-702`).
6. Ante fallo de red o hipo de Telegram: `sleep(2000)` y reintenta.

## `ALLOWED_UPDATES`

`:7-19` — `message`, `edited_message`, `callback_query`, `inline_query`, `guest_message`,
`pre_checkout_query`, `chat_join_request`, `managed_bot`, `my_chat_member`, `chat_member`,
`message_reaction`.

## Nota

El bot primario `@ModryvaBot` corre por polling; los **managed bots** hijos entran por webhook a través del
proxy de [[App web]]. El listado `BOT_COMMANDS` refleja el checklist de `docs/BOTFATHER.md`.

## Relaciones

- Pertenece a: [[Bot Core Map]]
- Depende de: [[Package telegram]] (`HttpTelegramGateway`), [[Runtime URL]]
- Utilizado por: [[App bot]]
- Relacionado con: [[Bot Update Service]], [[Bot Pipeline]], [[Update Lifecycle]], [[Infrastructure Map]]
