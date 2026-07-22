---
id: modryva-support-csat
title: Encuestas CSAT
type: feature
domain: support
status: partial
maturity: stable
source:
  - modules/support/src/csat.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Encuestas CSAT

## Qué hace
Satisfacción del cliente (CSAT) tras resolver un ticket. `computeCsat(votes)`
agrega votos de 1 a 5 estrellas en un resumen: media, número de votos válidos,
promotores (puntuación 5), detractores (≤ 3) y NPS en rango -100..100. Descarta
votos con puntuación fuera de rango o no entera (`isValidCsatVote`); seguro ante
lista vacía (media y NPS quedan en `null`). Puro y determinista.

## Evidencia
- `modules/support/src/csat.ts:54` `computeCsat`; `csat.ts:44` `isValidCsatVote`;
  umbrales en `csat.ts:32`.
- Test: `modules/support/src/csat.test.ts`.
- Cableado: NO se halló invocación en `apps/` (grep de `computeCsat` sin
  resultados fuera de tests).

## Estado / cableado
`partial`: lógica pura completa y testeada, pero SIN cablear. No hay comando ni
pipeline que recoja votos ni muestre el resumen; se exporta del barrel pero
`apps/` no lo importa. Conceptualmente encaja tras
[[Seguimiento de Tickets Resueltos]].

## Preguntas abiertas
- ¿Existe intención de recoger votos CSAT (botones de estrellas) tras cerrar un
  ticket y persistirlos? → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Seguimiento de Tickets Resueltos]], [[Tickets de Soporte]], [[Riesgo Features de lógica pura sin cablear]]
