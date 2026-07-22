---
id: modryva-support-sla-tracker
title: Seguimiento de SLA
type: feature
domain: support
status: partial
maturity: stable
source:
  - modules/support/src/sla-tracker.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Seguimiento de SLA

## Qué hace
Motor puro que decide si un item de soporte/moderación incumplió su objetivo de
respuesta (SLA) y si debe escalarse. `evaluateSla(item, nowMs, targets)` usa
objetivos por severidad (`alta` 15 min, `media` 60 min, `baja` 4 h por defecto en
`SLA_DEFAULT_TARGETS`). Si ya hubo primera respuesta, solo puede marcar
`breached` (nunca escala un item atendido); si no hubo respuesta, incumple al
superar el objetivo y escala al superar objetivo × `SLA_ESCALATION_FACTOR` (×2).

## Evidencia
- `modules/support/src/sla-tracker.ts:73` `evaluateSla`; objetivos en
  `sla-tracker.ts:35`; factor de escalado en `sla-tracker.ts:46`.
- Test: `modules/support/src/sla-tracker.test.ts`.
- Cableado: NO se halló invocación en `apps/` (grep de `evaluateSla` sin
  resultados fuera de tests).

## Estado / cableado
`partial`: lógica pura completa y testeada, pero SIN cablear a ningún comando ni
pipeline del bot. Se exporta desde el barrel del módulo pero `apps/bot` y
`apps/api` no la importan.

## Preguntas abiertas
- ¿Se planea conectar el SLA a la cola de tickets/moderación y a
  [[Escalado a Humano]]? → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Escalado a Humano]], [[Tickets de Soporte]], [[Riesgo Features de lógica pura sin cablear]]
