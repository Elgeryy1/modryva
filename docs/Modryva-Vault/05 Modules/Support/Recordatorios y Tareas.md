---
id: modryva-support-reminders-tasks
title: Recordatorios y Tareas
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/natural-reminder.ts
  - modules/support/src/productivity.ts
tags:
  - modryva
  - feature
  - support
aliases:
  - Recordatorios en Lenguaje Natural
created: 2026-07-12
updated: 2026-07-12
---

# Recordatorios y Tareas

## Qué hace
Recordatorios y tareas de staff, estilo Skeddy:
- Comandos estructurados (`productivity.ts`): `parseReminderCommand`
  (`/remind <minutos> <texto>`, `/reminders`, `/unremind <id>`) y
  `parseTaskCommand` (`/task <titulo>`, `/tasks`, `/taskdone <id>`);
  `reminderRunAtMs` calcula el instante de disparo.
- Lenguaje natural (`natural-reminder.ts`): `parseNaturalReminder` interpreta
  frases como "en 2 horas ...", "mañana a las 17:00 ..." o "a las 9 ..." a un
  instante absoluto (con offset de zona horaria); devuelve `null` si no encaja,
  para caer al formato `/remind`. `formatReminderTime` reformatea el instante
  ("vie 4 jul a las 17:00").

## Evidencia
- `modules/support/src/productivity.ts:23` `parseReminderCommand`;
  `productivity.ts:89` `parseTaskCommand`; `productivity.ts:123`
  `reminderRunAtMs`.
- `modules/support/src/natural-reminder.ts:38` `parseNaturalReminder`;
  `natural-reminder.ts:102` `formatReminderTime`.
- Tests: `productivity.test.ts`, `natural-reminder.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:7137`
  (`parseReminderCommand`) y `bot-update.service.ts:7153`
  (`parseNaturalReminder`) en `handleReminderCommand`; `parseTaskCommand`
  importado en `bot-update.service.ts:565` (`handleTaskCommand`).

## Estado / cableado
`implemented`: cableado a `handleReminderCommand` y `handleTaskCommand`. El
lenguaje natural actúa como capa sobre el `/remind` estructurado.

## Preguntas abiertas
- Persistencia y disparo real de recordatorios (scheduler) fuera de este módulo →
  `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Presets Verticales]]
