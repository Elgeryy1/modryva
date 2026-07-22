---
id: modryva-automation-reputacion-de-contenido
title: Reputación de Contenido
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/content-reputation.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - decideContentReputation
created: 2026-07-12
updated: 2026-07-12
---

# Reputación de Contenido

## Qué hace
Decide si un contenido (p. ej. un enlace visto muchas veces) ha ganado reputación suficiente para
auto-permitirlo. `decideContentReputation({ approvals, rejections }, options?)` → `{ trusted, score }`
(`content-reputation.ts:32-40`):

- `score = approvals - rejections` (`:37`).
- `trusted` solo si `approvals >= minApprovals` (por defecto `DEFAULT_MIN_APPROVALS = 20`) **y** nunca
  fue rechazado (`rejections === 0`) (`:24`, `:38`). Pura y determinista.

## Evidencia
- `modules/automation/src/content-reputation.ts:32-40`.
- Cableado en el bot, comando `/reputacion_contenido`:
  `apps/bot/src/bot-update.service.ts:15347` (case + invocación
  `decideContentReputation({ approvals, rejections })`).
- Import: `apps/bot/src/bot-update.service.ts:108`.
- Tests: `modules/automation/src/content-reputation.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta desde `/reputacion_contenido`, pero el comando es **diagnóstico**:
el usuario pasa aprobaciones/rechazos y el bot dice si el contenido sería de confianza; no auto-permite
enlaces por sí mismo. La regla "1 rechazo lo descalifica para siempre" (`rejections === 0`) es estricta
y merece considerarse si se cableara a un allowlist real.

## Preguntas abiertas
- ¿Existe un contador persistido de approvals/rejections por enlace/contenido que alimente esto en
  automático? No observable desde el módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Modo Solo Lectura]], [[Cierre de Tema]]
