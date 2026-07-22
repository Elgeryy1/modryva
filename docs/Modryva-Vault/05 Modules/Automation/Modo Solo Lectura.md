---
id: modryva-automation-modo-solo-lectura
title: Modo Solo Lectura
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/read-only-mode.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - decideReadOnly
created: 2026-07-12
updated: 2026-07-12
---

# Modo Solo Lectura

## Qué hace
Decide si el bot debería pasar a modo solo lectura cuando la API de Telegram falla demasiado.
`decideReadOnly({ apiErrorRate }, options?)` → `{ readOnly, reason }` (`read-only-mode.ts:25-37`):

- Entra en solo lectura cuando `apiErrorRate >= threshold` (por defecto 0.5) (`:29-30`).
- `reason` es un mensaje en español ("Modo solo lectura: la API de Telegram falla demasiado." /
  "API estable: modo normal.") (`:33-35`). Pura y determinista.

## Evidencia
- `modules/automation/src/read-only-mode.ts:25-37`.
- Cableado en el bot, comando `/modo_solo_lectura <tasa_error_api 0-1>`:
  `apps/bot/src/bot-update.service.ts:16279` (case), `:16284`
  `decideReadOnly({ apiErrorRate })`, respuesta con `decision.reason` en `:16285`.
- Import: `apps/bot/src/bot-update.service.ts:109`.
- Tests: `modules/automation/src/read-only-mode.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta desde `/modo_solo_lectura`, pero el comando es **diagnóstico**: el
usuario introduce la tasa de error y el bot responde qué decidiría; **no** pone realmente el bot en
solo lectura ni mide la tasa de error de la API en continuo. Sería el freno para degradar con gracia
ante 429/errores masivos, pero hoy es informativo.

## Preguntas abiertas
- ¿Hay una métrica real de `apiErrorRate` (por ventana) que dispare esto automáticamente? No observable
  desde el módulo → `unknown`. Posible relación con [[Cola de Pendientes]] (buffer mientras Telegram
  falla).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Cola de Pendientes]], [[Prioridad Crítica]], [[Reputación de Contenido]]
