---
id: modryva-automation-motor-de-reglas
title: Motor de Reglas
type: feature
domain: automation
status: partial
maturity: experimental
source:
  - modules/automation/src/rule-engine.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - evaluateRule
  - evaluateRules
  - EcaRule
created: 2026-07-12
updated: 2026-07-12
---

# Motor de Reglas

## Qué hace
Motor de reglas **evento-condición-acción (ECA)** puro y determinista. Cada `EcaRule` escucha un
`event`; cuando llega un `RuleContext` con ese mismo evento se evalúan TODAS sus `conditions` contra
los `fields` planos del contexto (AND). Antes de las condiciones aplica dos frenos temporales:
caducidad (`expiresAtMs`) y enfriamiento (`cooldownMs` contra `lastFiredMs`). No hay I/O, red ni
`Date.now()`: el llamador provee `nowMs` y los timestamps (`rule-engine.ts:1-9`).

- Operadores de condición: `eq | neq | gt | lt | contains` (`rule-engine.ts:12`, comparación en `:68-89`).
  `gt`/`lt` fuerzan `Number(...)`; `contains` compara como string.
- `evaluateRule(rule, ctx)` devuelve `{ fires, reason }` con `reason` explicativa:
  `event-mismatch | expired | cooldown | condition-failed | missing-field | fires`
  (`rule-engine.ts:54-60`, `:98-134`). El orden de los frenos es evento → caducidad → cooldown →
  condiciones (`:102-131`).
- Un campo ausente en el contexto hace fallar su condición con `missing-field` (`:120-122`).
- `evaluateRules(rules, ctx)` filtra el lote preservando el orden y devuelve las que disparan
  (`rule-engine.ts:145-150`).

## Evidencia
- `modules/automation/src/rule-engine.ts:98-134` (`evaluateRule`), `:145-150` (`evaluateRules`).
- Exportado por el barrel `modules/automation/src/index.ts:24`.
- Tests: `modules/automation/src/rule-engine.test.ts`.
- Búsqueda de invocación en `apps/`: **0 resultados** para `evaluateRule` / `evaluateRules`
  (ni bot, ni api, ni worker) → no está cableado.

## Estado / cableado
`partial`. Es lógica pura y testeada, pero **no la usa ninguna app**. La coincidencia de
automatizaciones que el bot ejecuta de verdad NO pasa por este motor: usa `matchAutomation` de
`@superbot/data` sobre el modelo Prisma `AutomationRule` (ver `apps/bot/src/bot-update.service.ts:84`,
`matchAndRunAutomations` `:5927-5957`) y la Mini App gestiona ese mismo modelo vía
[[Controller automation]]. Este `EcaRule` es un motor alternativo, más genérico (condiciones sobre
campos arbitrarios), que quedó sin conectar.

## Preguntas abiertas
- ¿Se pretende migrar la evaluación real (`matchAutomation` sobre `AutomationRule`) a este motor ECA,
  o es un diseño paralelo abandonado? No verificable desde el código → `unknown`.
- El cooldown aquí se apoya en `lastFiredMs` que debe proveer el llamador; quién persistiría ese
  timestamp no está definido en el módulo.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Modelo AutomationRule]], [[Controller automation]], [[Simulación de Reglas]],
  [[Enfriamiento de Reglas]], [[Detector de Bucles de Reglas]], [[Riesgo Features de lógica pura sin cablear]]
