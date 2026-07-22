---
id: moc-workflows
title: Workflows Map
type: moc
domain: workflow
status: partial
maturity: alpha
tags:
  - modryva
  - moc
  - workflow
created: 2026-07-12
updated: 2026-07-12
---

# Workflows Map

Flujos end-to-end del sistema. Cada flujo documenta: disparador, precondiciones, actores, componentes,
secuencia, persistencia, eventos, errores, seguridad, observabilidad, tests y enlaces. Notas en `08 Workflows/`.

## Flujos núcleo

- [[Flujo Update de Telegram]] — de `getUpdates` a la respuesta.
- [[Flujo Ejecución de Comando]] — dispatch → permisos → handler → efecto.
- [[Flujo Sesión Mini App]] — `POST v1/miniapp/session`, initData, resolución de grupo.

## Flujos de moderación

- [[Flujo Warn]] · [[Flujo Mute]] · [[Flujo Ban]] · [[Flujo Revisión y Cola]] · [[Flujo Apelación]]

## Flujos de comunidad / worker

- [[Flujo Recap Semanal]] · [[Flujo RSS a Post]] · [[Flujo Trivia]]

## Flujos de casino

- [[Casino Bet Lifecycle]] — apuesta instant vs multi-paso.

## Flujos de plataforma

- [[Flujo Alta de Bot Hijo]] · [[Webhook de Bots Hijos]]

## Automatizaciones

Ver [[Módulo automation]] (reglas/triggers configurables).

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Bot Core Map]], [[Events Map]], [[Security Map]], [[Operations Map]]
