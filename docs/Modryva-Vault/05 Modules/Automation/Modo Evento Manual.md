---
id: modryva-automation-modo-evento-manual
title: Modo Evento Manual
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/event-mode.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - rulesForManualEvent
  - ManualEvent
created: 2026-07-12
updated: 2026-07-12
---

# Modo Evento Manual

## Qué hace
Devuelve la postura de reglas recomendada para un evento de grupo declarado manualmente.
`rulesForManualEvent(event)` → `{ event, strict, note }` (nota en español) (`event-mode.ts:32-35`).

- `ManualEvent = "directo" | "sorteo" | "raid" | "clase" | "normal"` (`event-mode.ts:2`).
- Postura por evento (`:14-26`): `directo`, `sorteo`, `raid`, `clase` → `strict: true` con nota
  específica (antiflood reforzado, anti-spam al máximo, modo emergencia, silencio de juegos/enlaces);
  `normal` → `strict: false`, "reglas estándar". Pura y determinista.

## Evidencia
- `modules/automation/src/event-mode.ts:32-35`.
- Cableado en el bot, comando `/modo_evento <directo|sorteo|raid|clase|normal>`:
  `apps/bot/src/bot-update.service.ts:15432` (case, valida el evento en `:15434-15445`),
  `:15446` `rulesForManualEvent(event as ManualEvent)`, respuesta 🎬 en `:15447-15449`.
- Import: `apps/bot/src/bot-update.service.ts:115` (y tipo `ManualEvent` en `:110`).
- Tests: `modules/automation/src/event-mode.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta desde `/modo_evento`, pero el comando es **diagnóstico**: informa
la postura recomendada (`strict` + nota); no aplica por sí mismo el endurecimiento en el grupo. El
efecto real (antiflood, captcha, límites) lo aplican otros módulos según su propia config. Distinto de
[[Modo Examen]] (ventana horaria) y [[Reglas por Franja Horaria]] (según hora).

## Preguntas abiertas
- ¿Existe persistencia del "evento activo" que module de verdad antiflood/antiraid mientras dura? No
  observable desde el módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Modo Examen]], [[Reglas por Franja Horaria]], [[Disparador por Volumen]]
