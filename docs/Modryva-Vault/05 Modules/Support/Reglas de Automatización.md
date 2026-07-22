---
id: modryva-support-automation
title: Reglas de Automatización
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/d1.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Reglas de Automatización

## Qué hace
Reglas simples "si el mensaje contiene X, haz Y" gestionadas desde el subsistema
D1 (`d1.ts`).
- `parseAutomationCommand`: `/auto` (o `/automation`) con subcomandos `list`,
  `remove <id>` y `add contains <texto> -> reply|delete|quarantine|log [texto]`.
  Las acciones `reply` y `log` exigen texto (`text-required`).
- `automationMatches(rule, text)`: evalúa si una regla activa de tipo `contains`
  aplica al texto (comparación en minúsculas).
- `formatAutomationList`: lista legible de reglas configuradas.

## Evidencia
- `modules/support/src/d1.ts:325` `parseAutomationCommand`; `d1.ts:499`
  `automationMatches`; `d1.ts:587` `formatAutomationList`; tipo
  `AutomationCommand` en `d1.ts:42`.
- Test: `modules/support/src/d1.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:6593`
  (`parseAutomationCommand(update)`) en `handleAutomationCommand`; import
  `automationMatches` en `bot-update.service.ts:505`.

## Estado / cableado
`implemented`: cableado a `handleAutomationCommand`. La acción `quarantine`
conecta con [[Cola de Cuarentena D1]].

## Preguntas abiertas
- Persistencia de las reglas y en qué punto del pipeline de mensajes se evalúa
  `automationMatches` en `apps/bot` → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Cola de Cuarentena D1]], [[Autodiagnóstico del Grupo]]
