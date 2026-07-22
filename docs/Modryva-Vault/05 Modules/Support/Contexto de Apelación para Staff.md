---
id: modryva-support-appeal-summary
title: Contexto de Apelación para Staff
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/appeal-summary.ts
  - modules/support/src/appeal-history.ts
  - modules/support/src/appeal-learning.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Contexto de Apelación para Staff

## Qué hace
Tres ayudas de decisión que dan contexto al staff al revisar una apelación:
- `summarizeAppealForStaff({ category, length, hasEvidence })`: línea de triage
  que combina categoría, tamaño del texto (breve/media/extensa) y presencia de
  pruebas, y deriva una prioridad (`alta`/`media`/`baja`).
- `summarizeAppealHistory(appeals)`: agrega el historial de un usuario (total,
  aceptadas, rechazadas y `acceptRate` redondeado a 2 decimales).
- `buildAppealLearning({ accepted, rule })`: mensaje de cierre al apelante que,
  si se acepta, reconoce el error y promete ajustar la regla; si se rechaza,
  mantiene la sanción cortésmente.

## Evidencia
- `modules/support/src/appeal-summary.ts:53` `summarizeAppealForStaff`.
- `modules/support/src/appeal-history.ts:34` `summarizeAppealHistory`.
- `modules/support/src/appeal-learning.ts:29` `buildAppealLearning`.
- Tests: `appeal-summary.test.ts`, `appeal-history.test.ts`,
  `appeal-learning.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:15083`
  (`summarizeAppealForStaff` → `/resumen_apelacion`),
  `bot-update.service.ts:16861` (`summarizeAppealHistory` →
  `/historial_apelaciones`) y `bot-update.service.ts:15071`
  (`buildAppealLearning` → `/aprendizaje_apelacion`), todos en
  `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: los tres se exponen como comandos de utilidad/diagnóstico
(`/resumen_apelacion`, `/historial_apelaciones`, `/aprendizaje_apelacion`). No se
verificó que se inyecten automáticamente en el mensaje de log de
[[Apelaciones por Privado]].

## Preguntas abiertas
- ¿El historial usado por `summarizeAppealHistory` viene de [[Modelo Appeal]] en
  el handler? → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Apelaciones por Privado]], [[Clasificación de Apelaciones]], [[Analítica de Apelaciones]], [[Modelo Appeal]]
