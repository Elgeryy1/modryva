---
id: modryva-adr-004
title: ADR-004 Lógica de dominio pura y testeable por fichero
aliases: [ADR-004 Lógica de dominio pura y testeable]
type: decision
domain: decision
status: inferred
maturity: stable
source:
  - modules
tags:
  - modryva
  - decision
  - testing
created: 2026-07-12
updated: 2026-07-12
---

# ADR-004 — Lógica de dominio pura y testeable, una feature por fichero

## Estado
**inferred**.

## Contexto
Gran cantidad de features (moderación, comunidad, juegos) que deben ser correctas y verificables sin arrancar
Telegram/BD.

## Decisión
Escribir la lógica de dominio como **funciones puras y deterministas**, una feature por fichero
(`x.ts` + `x.test.ts` hermano), separada del I/O (bot/api/worker la orquestan). Ejemplo canónico: el casino
(`fairness.ts` provably-fair, resolvers puros → `{multiplier, detail}`).

## Evidencia
497 ficheros `*.test.ts`; patrón feature-por-fichero en `modules/community` (139), `modules/security` (124),
`modules/games` (72); [[Testing Map]].

## Alternativas
Lógica acoplada a los handlers (más difícil de testear).

## Consecuencias positivas
Altísima testeabilidad; provably-fair verificable; refactors seguros.

## Consecuencias negativas
Muchas features quedan **puras pero sin cablear** a UX → [[Riesgo Features de lógica pura sin cablear]].
El orquestador (bot) acumula el cableado → [[Riesgo God Object bot-update]].

## Componentes afectados
Todos los [[Modules Map]] · [[Testing Map]].

## Relaciones
- Pertenece a: [[Decisions Map]]
- Relacionado con: [[Testing Map]], [[Riesgo Features de lógica pura sin cablear]]
