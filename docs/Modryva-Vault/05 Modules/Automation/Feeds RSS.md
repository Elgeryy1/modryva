---
id: modryva-automation-feeds-rss
title: Feeds RSS
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/rss.ts
  - apps/bot/src/bot-update.service.ts
  - apps/worker/src/rss-processor.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - parseRssCommand
  - parseFeedItems
  - selectNewItems
created: 2026-07-12
updated: 2026-07-12
---

# Feeds RSS

## Qué hace
Automatización que publica en el grupo los nuevos ítems de un feed RSS/Atom. El módulo cubre el parseo
del comando y el parseo/diff del feed:

- `parseRssCommand(update)` parsea `/rss add <url> | list | remove <id>`, valida URL http(s) y devuelve
  resultado discriminado ok/error (`rss.ts:28-70`).
- `parseFeedItems(xml)` extractor minimalista de `<item>` (RSS) y `<entry>` (Atom) → `FeedItem
  { guid, title, link }`; decodifica entidades/CDATA y soporta `<link href="…">` de Atom; el `guid`
  cae a `id`/`link`/`title` si falta (`rss.ts:78-120`).
- `selectNewItems(items, lastSeenGuid)` devuelve lo más nuevo que `lastSeenGuid` (todo lo anterior a su
  primera aparición, porque los feeds listan lo más reciente primero); si no lo encuentra, considera
  todo nuevo (`rss.ts:127-137`).

## Evidencia
- `modules/automation/src/rss.ts:28-137`.
- Cableado (bot) en `handleRssCommand`: `apps/bot/src/bot-update.service.ts:7054`
  (`parseRssCommand`). Import: `:111`.
- Cableado (worker) en `apps/worker/src/rss-processor.ts:2` (import), `:46`
  `const items = parseFeedItems(xml)`, `:52` `selectNewItems(items, feed.lastItemGuid ?? undefined)`.
- Tests: `modules/automation/src/rss.test.ts`.

## Estado / cableado
`implemented` (end-to-end). El comando `/rss` gestiona el alta/baja del feed y el worker
(`rss-processor.ts`) descarga el XML, parsea ítems y publica solo los nuevos avanzando `lastItemGuid`.
Es de las pocas automatizaciones del módulo con efecto real completo. El fetch HTTP del XML y la
publicación viven en el worker (fuera de este módulo). Ver hub: [[Job rss]] / [[Integración RSS]].

## Preguntas abiertas
- La cadencia de polling y el guardado de `lastItemGuid` son responsabilidad del worker/repositorio;
  su detalle no es parte de este módulo.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Webhooks Salientes]], [[Job rss]], [[Integración RSS]]
