---
id: modryva-automation-detector-de-bucles-de-reglas
title: Detector de Bucles de Reglas
type: feature
domain: automation
status: partial
maturity: experimental
source:
  - modules/automation/src/rule-loop-detector.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - detectRuleLoops
  - hasRuleLoop
  - ruleLoopNodes
created: 2026-07-12
updated: 2026-07-12
---

# Detector de Bucles de Reglas

## Qué hace
Detecta ciclos en el grafo dirigido de reglas: cuando una regla dispara a otra y la cadena vuelve
sobre sí misma (una automatización que se retroalimenta). Lógica pura y determinista sobre una lista
plana de aristas `from -> to`, sin I/O ni reloj (`rule-loop-detector.ts:1-12`).

- `detectRuleLoops(edges)` devuelve todos los ciclos elementales; cada ciclo empieza por su nodo mínimo
  (orden de string), sin repetir el nodo de cierre; un self-loop `a -> a` es `["a"]`; las aristas
  duplicadas se colapsan y el orden de salida es independiente del de entrada (`:36-98`). Usa DFS con
  la técnica de "mantener `start` como mínimo" para descubrir cada ciclo exactamente una vez (`:78-93`).
- `hasRuleLoop(edges)` → boolean (`:103-104`).
- `ruleLoopNodes(edges)` → identificadores implicados en algún bucle, ordenados y sin duplicados
  (`:110-120`).

## Evidencia
- `modules/automation/src/rule-loop-detector.ts:44-120`.
- Exportado en `modules/automation/src/index.ts:26`.
- Tests: `modules/automation/src/rule-loop-detector.test.ts`.
- Invocación en `apps/`: **0 resultados** para `detectRuleLoops` / `hasRuleLoop` → no cableado.

## Estado / cableado
`partial`. Salvaguarda pensada para validar cadenas de automatizaciones (evitar loops infinitos) antes
de guardarlas, pero **no la invoca** el bot, la api ni el worker. El modelo real `AutomationRule`
(ver [[Controller automation]]) no expresa hoy "regla que dispara a regla", por lo que no hay aún un
grafo que alimentar.

## Preguntas abiertas
- ¿Existe (o se planea) un campo en `AutomationRule` que encadene reglas y genere estas aristas? No se
  observa en el esquema referenciado desde el módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Motor de Reglas]], [[Simulación de Reglas]], [[Modelo AutomationRule]]
