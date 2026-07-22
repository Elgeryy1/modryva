---
id: moc-bot-core
title: Bot Core Map
type: moc
domain: botcore
status: implemented
maturity: beta
tags:
  - modryva
  - moc
  - botcore
created: 2026-07-12
updated: 2026-07-12
---

# Bot Core Map

Núcleo del bot: cómo un update de Telegram entra, se procesa y se responde. Notas en `04 Bot Core/`.
Ficheros fuente clave: `apps/bot/src/{poller,pipeline,delivery,core-handlers,bot-update.service}.ts`.

## Ciclo de vida

- [[Bot Pipeline]] — poller → pipeline → handlers → delivery.
- [[Update Lifecycle]] — de `getUpdates` a la acción.
- [[Flujo Update de Telegram]] — flujo end-to-end (ver [[Workflows Map]]).

## Componentes

- [[Poller]] — long-polling contra la Bot API.
- [[Bot Update Service]] — despacho central (**God Object**, ~muchas líneas → [[Riesgo God Object bot-update]]).
- [[Core Handlers]] · [[Delivery]] · [[Runtime URL]].

## Relacionado

- [[Package telegram]] (gateway) · [[Commands Map]] (los comandos) · [[Events Map]] (eventos que dispara).
- [[Modryva Hub Map]] — resolución de bot/tenant por update.

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Architecture Map]], [[Commands Map]], [[Events Map]], [[Package telegram]]
