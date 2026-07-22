---
id: modryva-roadmap-refactor-god-object
title: Roadmap Refactor God Object
type: roadmap
domain: roadmap
status: planned
maturity: unknown
source:
  - apps/bot/src
tags:
  - modryva
  - roadmap
  - bot-core
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Roadmap — descomponer el God Object del bot

## Estado
**planned**.

## Problema que resuelve
[[Riesgo God Object bot-update]]: el dispatcher central ([[Bot Update Service]]) acumula el cableado de casi
todas las features (su test es un único fichero de ~364 KB), lo que lo hace frágil y difícil de evolucionar.

## Idea
- Extraer el enrutado a un **registro de handlers** declarativo (mapa comando/evento → handler) en vez de una
  cadena `if/else` gigante.
- Mover la orquestación específica de cada dominio a su módulo, dejando el core como *router* fino.
- Partir la suite monolítica `bot-update.service.test.ts` por handler.

## Impacto
Medio-alto (mantenibilidad, velocidad de cambio, aislamiento de fallos —también ayuda con
[[Riesgo Long-polling single-consumer]] al acotar excepciones por handler).

## Evidencia del estado actual
Dispatch en `bot-update.service.ts` (cadena `botHandlers()`), señalado también por el agente de comandos.

## Relaciones
- Pertenece a: [[Roadmap Map]]
- Mitiga: [[Riesgo God Object bot-update]]
- Relacionado con: [[Bot Core Map]], [[ADR-004 Lógica de dominio pura y testeable por fichero]]
