---
id: modryva-module-support
title: Módulo support
type: module
domain: support
status: partial
maturity: beta
source:
  - modules/support/src
tags:
  - modryva
  - module
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Módulo support

## Propósito
Soporte, tickets, apelaciones y comunicación con usuarios. Paquete `@superbot/module-support` (79 ficheros
src, 78 tests). Un bloque muy grande gira en torno al ciclo de **apelaciones** (appeal-*) y a la gestión de
**anuncios** (announcement-*). Patrón feature-por-fichero; muchas `partial`.

## Áreas (verificado `modules/support/src`)
- **Apelaciones**: `appeal-classification`, `appeal-eta`, `appeal-grouping`, `appeal-guided`,
  `appeal-history`, `appeal-honesty`, `appeal-learning`, `appeal-spam`, `appeal-status`, `appeal-summary`,
  `collective-appeal`, `accepted-appeals-report`. → [[Modelo Appeal]], [[Flujo Apelación]].
- **Anuncios**: `announcement-composer`, `announcement-expiry`, `announcement-frequency`,
  `announcement-preview`.
- **Tickets / casos**: `case-metrics`, `client-history`, `bug-ranking`, `bot-error-escalation`,
  `angry-customer`, `async-mediation`, `budget-guard`, `campaign-phases`, `anti-copy`.

## Superficie
Comando `/tickets`; datos en [[Modelo Ticket]] / [[Modelo TicketMessage]] / [[Modelo Appeal]].
La apelación por privado se relaciona con moderación ([[Flujo Ban]] → [[Flujo Apelación]]).

## Cableado
`partial`: enorme cobertura de tests sobre lógica pura; confirmar cuánto está conectado a comandos/UX.
Ver [[Riesgo Features de lógica pura sin cablear]].

## Relaciones
- Pertenece a: [[Modules Map]]
- Consume: [[Modelo Appeal]], [[Modelo Ticket]]
- Relacionado con: [[Security Map]], [[Flujo Apelación]]
