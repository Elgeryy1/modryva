---
id: modryva-automation-disparador-por-volumen
title: Disparador por Volumen
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/volume-trigger.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - shouldActivateVolumeProtection
created: 2026-07-12
updated: 2026-07-12
---

# Disparador por Volumen

## Qué hace
Decide si activar protección extra cuando la actividad se dispara respecto a una línea base.
`shouldActivateVolumeProtection({ baseline, current }, options?)` → `{ activate, ratio }`
(`volume-trigger.ts:36-46`):

- `ratio = current / baseline` redondeado a 2 decimales (`:44`, `roundVolumeRatio` `:27-28`).
- Activa cuando `ratio >= spikeRatio` (por defecto 3, es decir un pico del 300 %) (`DEFAULT_SPIKE_RATIO`
  `:24`, `:45`).
- `baseline <= 0` → `{ activate: false, ratio: 0 }` (nada con qué comparar) (`:41-43`). Pura y
  determinista.

## Evidencia
- `modules/automation/src/volume-trigger.ts:36-46`.
- Cableado en el bot, comando `/activar_proteccion_volumen`:
  `apps/bot/src/bot-update.service.ts:16764` (case), `:16764`
  `shouldActivateVolumeProtection({ baseline, current })`.
- Import: `apps/bot/src/bot-update.service.ts:116`.
- Tests: `modules/automation/src/volume-trigger.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta desde `/activar_proteccion_volumen`, que es **diagnóstico**: el
usuario pasa `baseline` y `current` y el bot dice si se activaría la protección y con qué ratio; no
enciende por sí mismo antiflood/antiraid. El disparador de "pico de volumen" no está conectado a un
conteo real de mensajes que lo evalúe en continuo.

## Preguntas abiertas
- ¿De dónde saldrían `baseline` y `current` en un flujo automático (ventana de actividad real)? No
  observable desde el módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Modo Evento Manual]], [[Cierre de Tema]], [[Prioridad Crítica]]
