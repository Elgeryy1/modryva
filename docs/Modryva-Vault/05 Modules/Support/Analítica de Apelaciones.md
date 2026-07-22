---
id: modryva-support-appeal-analytics
title: Analítica de Apelaciones
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/appeal-grouping.ts
  - modules/support/src/accepted-appeals-report.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Analítica de Apelaciones

## Qué hace
Dos agregados de solo lectura sobre las apelaciones:
- `bucketAppealsByIncident(appeals)`: agrupa apelaciones por incidente, listando
  usuarios distintos (orden ascendente) y el total por grupo, ordenado por
  recuento descendente y luego por `incidentId`. Detecta oleadas de apelaciones
  sobre un mismo incidente (posible falso positivo masivo).
- `summarizeAcceptedAppeals(appeals)`: cuenta apelaciones aceptadas por regla
  (`byRule` ordenado por recuento desc.) para ver qué reglas se revierten más y
  merecen revisión.

## Evidencia
- `modules/support/src/appeal-grouping.ts:23` `bucketAppealsByIncident`.
- `modules/support/src/accepted-appeals-report.ts:39` `summarizeAcceptedAppeals`.
- Tests: `appeal-grouping.test.ts`, `accepted-appeals-report.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:16875`
  (`bucketAppealsByIncident` → `/apelaciones_por_incidente`) y
  `bot-update.service.ts:16843` (`summarizeAcceptedAppeals` →
  `/informe_apelaciones_aceptadas`), en `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: ambos se exponen como comandos de utilidad
(`/apelaciones_por_incidente`, `/informe_apelaciones_aceptadas`). Existe además
`collective-appeal.ts` (`groupAppealsByIncident`, `detectMassFalsePositive`) con
la misma intención pero SIN cablear (ver Preguntas abiertas).

## Preguntas abiertas
- `modules/support/src/collective-appeal.ts` no se importa en `apps/` (grep sin
  resultados) → esa variante es `partial`; queda por decidir si sustituye o
  duplica a `appeal-grouping.ts`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Apelaciones por Privado]], [[Contexto de Apelación para Staff]], [[Modelo Appeal]]
