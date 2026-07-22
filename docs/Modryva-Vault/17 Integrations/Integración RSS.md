---
id: modryva-integration-rss
title: Integración RSS
type: integration
domain: automation
status: implemented
maturity: beta
source:
  - modules/automation/src/rss.ts
  - apps/worker/src/rss-processor.ts
tags:
  - modryva
  - integration
  - automation
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Integración RSS

## Qué es
Consumo de feeds RSS externos para publicar novedades en los grupos. Lógica en `modules/automation/src/rss.ts`,
ejecución periódica en [[Job rss]].

## Datos
[[Modelo Feed]] (config del feed y último visto para dedup).

## Fallos y resiliencia
Feed caído/timeout → backoff/reintento (`automation/retry-backoff.ts`).

## Relaciones
- Pertenece a: [[Integrations Map]]
- Utilizado por: [[Job rss]], [[Módulo automation]]
- Consume: [[Modelo Feed]]
