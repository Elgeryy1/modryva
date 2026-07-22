---
id: core-handlers
title: Core Handlers
type: component
domain: botcore
status: implemented
maturity: stable
source:
  - apps/bot/src/core-handlers.ts
tags:
  - modryva
  - component
  - botcore
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Core Handlers

`apps/bot/src/core-handlers.ts` son las **funciones puras** que resuelven los comandos y el menú de nivel
superior (estilo GroupHelp). No tocan la base de datos ni el gateway: reciben el `TelegramUpdateEnvelope` y
devuelven un `BotReply | null`. [[Bot Update Service]] las registra como handlers `core.command` y
`core.callback`.

## Exports

- **`handleCoreCommand(update, botUsername, miniApp?)`** (`:291`) — despacha:
  - `start` / `menu` → pantalla home con saludo personalizado (`homeText` + `buildHomeMenu`).
  - `help` → `sectionReply("help")` como mensaje nuevo (`edit: false`).
  - `status` → `sectionReply("status")`.
  - `cancel` → "Flujo cancelado.".
  - `settings` lo maneja `handleSettings` antes en la cadena (no se duplica aquí).
- **`handleCoreCallback(update, botUsername, miniApp?)`** (`:333`) — atiende callbacks `menu:*` editando el
  mensaje en sitio (navegación GroupHelp). `menu:home` vuelve al home; el resto renderiza la sección.
  Devuelve `null` para cualquier callback no-`menu:` para que sigan corriendo los handlers específicos.
- **`extractFirstName(raw)`** (`:7`) — saca el `first_name` del emisor para personalizar el saludo.

## Piezas internas

- `buildHomeMenu(botUsername)` — teclado inline cuya primera fila es el deep link
  `t.me/<bot>?startgroup=true&admin=...` ("Añádeme a un grupo") más 6 secciones
  (moderación, antispam, comunidad, admin, diversión, utilidades, IA, pagos, estado, guía).
- `sections` — diccionario de secciones (título + líneas de ayuda de comandos).
- **`MiniAppLink`** + `buildMiniAppButton` — decide entre botón `web_app` (chat privado) o `url` con
  `startapp` (grupos, donde Telegram rechaza `web_app`). Este tipo se propaga como `miniAppLink` en
  `BotHandlerInput`.

## Relaciones

- Pertenece a: [[Bot Core Map]]
- Depende de: [[Package domain]] (`BotReply`, `TelegramUpdateEnvelope`)
- Utilizado por: [[Bot Update Service]]
- Relacionado con: [[Bot Pipeline]], [[Delivery]]
