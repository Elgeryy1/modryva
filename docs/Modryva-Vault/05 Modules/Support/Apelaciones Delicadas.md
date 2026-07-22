---
id: modryva-support-delicate-appeal
title: Apelaciones Delicadas
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/delicate-appeal.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Apelaciones Delicadas

## Qué hace
Marca una apelación como delicada (para tratarla con cuidado extra) cuando
menciona a un menor de edad, plantea una cuestión legal o indica riesgo de
autolesión. `markDelicateAppeal(input)` recibe tres flags y devuelve `delicate`
más las razones en un orden fijo (menor, legal, autolesión) con etiquetas en
español; determinista.

## Evidencia
- `modules/support/src/delicate-appeal.ts:34` `markDelicateAppeal`; razones en
  `delicate-appeal.ts:25`.
- Test: `modules/support/src/delicate-appeal.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:551` (import) y
  `bot-update.service.ts:15300` (`markDelicateAppeal({...})`), servido por el
  comando `/apelacion_delicada` dentro de `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuesto como comando `/apelacion_delicada`. Recibe flags ya
resueltos por el handler; no se verificó que la detección de menor/legal/
autolesión se compute automáticamente sobre el texto de la apelación.

## Preguntas abiertas
- ¿Quién determina los flags `mentionsMinor` / `mentionsLegal` /
  `mentionsSelfHarm` en el handler? ¿Hay detección automática o son manuales? →
  `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Apelaciones por Privado]], [[Escalado a Humano]], [[Modelo Appeal]]
