---
id: modryva-roadmap-wiring-idea-bank
title: Roadmap Wiring Idea Bank
type: roadmap
domain: roadmap
status: partial
maturity: experimental
source:
  - modules
tags:
  - modryva
  - roadmap
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Roadmap — cablear las features de lógica pura ("idea bank")

## Estado
**partial** (proceso en curso: hay features puras testeadas que se van conectando a comandos/UX poco a poco).

## Problema que resuelve
[[Riesgo Features de lógica pura sin cablear]]: consecuencia de [[ADR-004 Lógica de dominio pura y testeable por fichero]].
Existe mucha lógica correcta y con tests que **no está expuesta** a ningún comando, callback o pantalla, y
21 modelos del esquema sin lector/escritor (hallazgo del inventario de datos → [[Data Model Overview]]).

## Idea
- Inventariar features puras sin cablear vs. "muros de datos" (qué se puede exponer reusando datos ya
  escritos y qué requeriría tablas/flujos nuevos).
- Priorizar quick-wins que reusan `activity-log` + `ChatSetting` (0 tablas nuevas).
- Cablear en oleadas: comando o sección de Mini App por feature.

## Impacto
Alto en valor percibido (convierte trabajo ya hecho en funcionalidad usable) con bajo coste marginal.

## Evidencia del estado actual
Alta densidad de `*.test.ts` por módulo (community/security/games) frente a menor superficie de comandos
cableados; 21 modelos sin acceso real (ver [[Data Model Overview]]).

## Preguntas abiertas
- Lista exacta priorizada de features puras sin cablear: `unknown` (requiere auditoría módulo a módulo).

## Relaciones
- Pertenece a: [[Roadmap Map]]
- Mitiga: [[Riesgo Features de lógica pura sin cablear]]
- Relacionado con: [[Modules Map]], [[Commands Map]]
