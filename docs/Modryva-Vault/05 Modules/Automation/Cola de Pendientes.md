---
id: modryva-automation-cola-de-pendientes
title: Cola de Pendientes
type: feature
domain: automation
status: partial
maturity: experimental
source:
  - modules/automation/src/pending-queue.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - computeQueuePosition
created: 2026-07-12
updated: 2026-07-12
---

# Cola de Pendientes

## Qué hace
Calcula la posición de una acción dentro de la cola de acciones pendientes (usada cuando Telegram
falla y el trabajo se buffer-ea). `computeQueuePosition(queue, id)` → `{ position, total, found }`:
posición 1-based (o -1 si no está), tamaño de la cola y si se encontró el id
(`pending-queue.ts:16-26`). Pura y determinista.

## Evidencia
- `modules/automation/src/pending-queue.ts:16-26`.
- Exportado en `modules/automation/src/index.ts:13`.
- Tests: `modules/automation/src/pending-queue.test.ts`.
- Invocación en `apps/`: **0 resultados** para `computeQueuePosition` → no cableado.
  (Nota: `pending-queue` aparece mencionado en el hub [[Módulo automation]], pero el símbolo no se
  importa en ninguna app.)

## Estado / cableado
`partial`. Utilidad de introspección de cola lista y testeada, pero **ninguna app la usa**. Complementa
a [[Prioridad Crítica]] (ordena por criticidad) y a [[Modo Solo Lectura]] (el escenario de degradación
donde el trabajo se acumula). No existe hoy una cola de pendientes real que la consuma.

## Preguntas abiertas
- ¿Se llegó a implementar el buffer de acciones pendientes (dónde vive la `queue`)? No observable desde
  el módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Prioridad Crítica]], [[Modo Solo Lectura]], [[Reintentos con Backoff]]
