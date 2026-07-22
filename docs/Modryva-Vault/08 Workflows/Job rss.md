---
id: modryva-job-rss
title: Job rss
type: workflow
domain: automation
status: implemented
maturity: beta
source:
  - apps/worker/src/rss-processor.ts
  - modules/automation/src/rss.ts
tags:
  - modryva
  - workflow
  - automation
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Job rss

## Qué hace
Sondea feeds RSS configurados y publica las novedades en los grupos suscritos. Procesador
`apps/worker/src/rss-processor.ts`; lógica en `modules/automation/src/rss.ts`.

## Secuencia
1. Lee feeds configurados ([[Modelo Feed]]).
2. Descarga/parsea el RSS (integración externa → [[Integración RSS]]).
3. Detecta ítems nuevos (dedup por último visto) y publica en el chat destino.

## Errores
Feed caído/timeout → reintento con backoff (ver `automation/retry-backoff.ts`).

## Tests
`apps/worker/src/rss-processor.test.ts`.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Depende de: [[App worker]], [[Módulo automation]]
- Consume: [[Modelo Feed]]
- Relacionado con: [[Integración RSS]]
