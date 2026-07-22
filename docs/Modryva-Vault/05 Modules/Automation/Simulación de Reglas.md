---
id: modryva-automation-simulacion-de-reglas
title: Simulación de Reglas
type: feature
domain: automation
status: partial
maturity: experimental
source:
  - modules/automation/src/rule-simulation.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - simulateRule
  - detectDeadRule
  - detectAggressiveRule
created: 2026-07-12
updated: 2026-07-12
---

# Simulación de Reglas

## Qué hace
Dry-run / replay de una regla sobre una muestra de eventos históricos, para estimar cuántas veces
habría disparado antes de activarla. Todo es lógica pura y determinista; el matcher se reimplementa
localmente para **no** depender del motor de reglas real (`rule-simulation.ts:1-8`, `:135-145`).

- `simulateRule(rule, samples)` → `{ wouldFire, total, impactPct, matchedMs }`: cuántos eventos
  dispararían, el total, el impacto en % (0 si la muestra está vacía) y los timestamps disparados en
  orden (`rule-simulation.ts:160-177`). `impactPct` se redondea a 1 decimal (`:151`).
- `ruleFiresOnEvent` exige coincidencia de tipo de evento y que TODAS las condiciones se cumplan (AND);
  sin condiciones, cualquier evento del tipo dispara (`:135-145`).
- Matcher propio `matchesRuleCondition` con operadores `eq | ne | gt | gte | lt | lte | contains`
  (nota: distinto del motor real, que usa `neq` y no tiene `gte`/`lte`) (`:22-29`, `:83-128`). Operador
  desconocido o campo ausente nunca cumple; las comparaciones de orden exigen ambos lados numéricos.
- `detectDeadRule(wouldFire, total)`: regla "muerta" si `wouldFire===0 && total>0` (`:184-185`).
- `detectAggressiveRule(impactPct, threshold=50)`: "agresiva" si supera el umbral, por defecto
  `AGGRESSIVE_RULE_THRESHOLD_PCT = 50` (`:69`, `:192-195`).

## Evidencia
- `modules/automation/src/rule-simulation.ts:160-195` (simular, dead, aggressive).
- Exportado en `modules/automation/src/index.ts:27`.
- Tests: `modules/automation/src/rule-simulation.test.ts`.
- Invocación en `apps/`: **0 resultados** para `simulateRule` / `detectDeadRule` /
  `detectAggressiveRule` → no cableado.

## Estado / cableado
`partial`. Diseñado como paso previo a `/simruleopt` / vista de simulación, pero no lo consume ninguna
app (bot, api ni worker). Nótese además la **divergencia de operadores** respecto a
[[Motor de Reglas]] (`ne` vs `neq`, y añade `gte`/`lte`): dos matchers distintos conviven sin fuente
única de verdad.

## Preguntas abiertas
- ¿De dónde saldría la muestra de `SampleEvent`? El módulo no define su origen (activity-log,
  cases…) → `unknown`.
- ¿Cuál de los dos matchers (este o el de `rule-engine.ts`) es el canónico? No resoluble desde el
  código.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Motor de Reglas]], [[Detector de Bucles de Reglas]], [[Modelo AutomationRule]]
