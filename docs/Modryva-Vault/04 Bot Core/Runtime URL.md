---
id: runtime-url
title: Runtime URL
type: component
domain: botcore
status: implemented
maturity: stable
source:
  - apps/bot/src/runtime-url.ts
  - docker-compose.yml
tags:
  - modryva
  - component
  - botcore
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Runtime URL

`apps/bot/src/runtime-url.ts` resuelve **la URL pública viva de la Mini App** en tiempo de ejecución, sin
reiniciar el bot cuando el túnel rota. Una sola función: `readAppUrl(fallback)`.

## Problema que resuelve

Con un **quick-tunnel** de Cloudflare la URL pública rota en cada reinicio. El sidecar `urlsync`
(`docker-compose.yml:204`) vigila los logs de `cloudflared` y escribe la URL actual en un volumen
compartido (`/state/app_url`), que el bot monta **read-only** (`bot ... volumes: tunnel_state:/state:ro`).
Así [[Poller]] re-fija el botón de menú apuntando siempre a la URL correcta.

## `readAppUrl(fallback)`

Lógica (`:11`):

1. Si `TELEGRAM_APP_URL_PINNED === "1"` y el `fallback` (env `TELEGRAM_APP_URL`) es `https://`: devuelve el
   `fallback` y **omite** el fichero de estado (caso del túnel **con nombre**, cuya URL nunca rota; evita
   leer una URL muerta de un run anterior).
2. Si existe `/state/app_url` y su contenido empieza por `https://`: devuelve esa URL viva.
3. En cualquier otro caso (dev local / sin túnel): devuelve el `fallback`.

## Dónde se usa

- [[Poller]] (`syncMenuButton`) para `setChatMenuButton`.
- [[Bot Update Service]] (`processWebhookScoped`) al construir el `MiniAppLink` de cada update y en
  `handleSettings` para decidir el botón de la Mini App.

## Relaciones

- Pertenece a: [[Bot Core Map]]
- Utilizado por: [[Poller]], [[Bot Update Service]]
- Relacionado con: [[App web]], [[Infrastructure Map]], [[Env TELEGRAM_BOT_TOKEN]]
