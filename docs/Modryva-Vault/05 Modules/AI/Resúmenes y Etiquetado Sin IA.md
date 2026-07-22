---
id: modryva-ai-heuristicas-sin-ia
title: Resúmenes y Etiquetado Sin IA
type: feature
domain: ai
status: partial
maturity: experimental
source:
  - modules/ai/src/fight-summary.ts
  - modules/ai/src/log-tagger.ts
tags:
  - modryva
  - feature
  - ai
aliases:
  - summarizeFight
  - tagLog
created: 2026-07-12
updated: 2026-07-12
---

# Resúmenes y Etiquetado Sin IA

## Qué hace
Dos utilidades heurísticas y deterministas que funcionan **sin claves de proveedor** (fallback de la capa de IA
aplicada): sin red, sin reloj, sin azar.

- **`summarizeFight(lines)`** (`modules/ai/src/fight-summary.ts:58-90`): a partir de líneas de chat
  cronológicas identifica quién inició la pelea (primer mensaje hostil), los participantes únicos en orden de
  aparición y el número de mensajes hostiles, y arma un resumen neutral para el staff. La hostilidad se detecta
  por marcadores normalizados (insultos/provocaciones) en `HOSTILE_MARKERS` (`fight-summary.ts:25-41`);
  la normalización es insensible a acentos y mayúsculas (`:43-44`). Ideas #11 y #212.
- **`tagLog(text)`** (`modules/ai/src/log-tagger.ts:39-49`): etiqueta una línea de log por palabras clave para
  filtrar/agrupar, devolviendo las etiquetas aplicables en el orden fijo de `LOG_TAGS`
  (`spam`, `permisos`, `staff`, `casino`, `bugs`, `moderacion`; `:9-16`) sin duplicados, según `TAG_KEYWORDS`
  (`:22-29`). Idea #338.

## Evidencia
- `modules/ai/src/fight-summary.ts:25-90`, `modules/ai/src/log-tagger.ts:9-49`.
- Tests: `modules/ai/src/fight-summary.test.ts:10-...` (iniciador, participantes en orden, chat tranquilo,
  insensible a acentos/mayúsculas, determinismo) y `modules/ai/src/log-tagger.test.ts:4-...` (spam, moderación,
  casino, bugs, multi-tag en orden fijo, sin duplicados, solo tags conocidos).

## Estado / cableado
`partial`. Ambas funciones están implementadas y bien probadas, pero **no están cableadas** en `apps/bot` ni
`apps/worker` (grep de `summarizeFight` / `tagLog` sin resultados fuera de su módulo y sus tests). No hay
comando ni handler que las invoque todavía; son piezas listas para conectar (p.ej. un resumen de conflicto para
staff o un filtro de logs).

## Preguntas abiertas
- ¿A qué comando/flujo se pretende conectar `summarizeFight` (¿recap de moderación? ¿reporte de pelea?) y
  `tagLog` (¿visor de logs?)? Intención de cableado = `unknown`.
- Los diccionarios de marcadores/keywords son listas fijas en español; su cobertura real no está medida.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Recap Semanal]], [[Selección de Proveedor de IA]]
