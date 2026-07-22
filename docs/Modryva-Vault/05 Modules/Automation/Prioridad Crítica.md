---
id: modryva-automation-prioridad-critica
title: Prioridad Crítica
type: feature
domain: automation
status: partial
maturity: experimental
source:
  - modules/automation/src/critical-priority.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - prioritizeActions
created: 2026-07-12
updated: 2026-07-12
---

# Prioridad Crítica

## Qué hace
Ordena acciones pendientes para que las más críticas se ejecuten primero durante saturación (p. ej.
cuando hay backlog de acciones de moderación). `prioritizeActions(actions)` → `PrioritizedAction[]`
(`critical-priority.ts:30-43`):

- Peso por tipo (`KIND_PRIORITY`): `ban`/`raid` = 3, `mute` = 2, `warn` = 1, cualquier otro = 0
  (`:16-22`, normaliza con `trim().toLowerCase()` `:36`).
- Ordena por prioridad descendente y, a igualdad, por `id` ascendente; no muta la entrada (`:38-42`).
  Pura y determinista.

## Evidencia
- `modules/automation/src/critical-priority.ts:30-43`.
- Exportado en `modules/automation/src/index.ts:3`.
- Tests: `modules/automation/src/critical-priority.test.ts`.
- Invocación en `apps/`: **0 resultados** para `prioritizeActions` → no cableado.

## Estado / cableado
`partial`. Priorizador de cola listo y determinista, pero **ninguna app lo usa**. Es la contraparte de
[[Cola de Pendientes]] (una calcula posición, esta ordena por criticidad), pensadas para cuando el bot
buffer-ea trabajo mientras Telegram falla ([[Modo Solo Lectura]]); ninguna de las dos está conectada a
una cola real.

## Preguntas abiertas
- ¿Existe una cola de acciones pendientes real (persistida/en memoria) que debería consumir este
  orden? No observable desde el módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Cola de Pendientes]], [[Modo Solo Lectura]], [[Reintentos con Backoff]]
