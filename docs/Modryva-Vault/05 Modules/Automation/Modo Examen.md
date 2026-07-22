---
id: modryva-automation-modo-examen
title: Modo Examen
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/exam-mode.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - rulesForExamMode
  - ExamModeSchedule
created: 2026-07-12
updated: 2026-07-12
---

# Modo Examen

## Qué hace
Silencia ciertas categorías de contenido durante una ventana horaria de examen/clase.
`rulesForExamMode(hourOfDay, options?)` → `{ active, blocked }` (`exam-mode.ts:57-73`):

- Cuando la hora cae en la ventana `[start, end)` activa el modo y reporta las categorías bloqueadas:
  `juegos`, `memes`, `enlaces` (`EXAM_MODE_BLOCKED`, `:5`, `:70-72`).
- Ventana por defecto 8..14 (`DEFAULT_EXAM_START=8`, `DEFAULT_EXAM_END=14`, `:8-11`), configurable vía
  `ExamModeSchedule { start?, end? }` (`:17-20`).
- Soporta ventanas nocturnas donde `start > end` (p. ej. 20..6); `start === end` = ventana vacía
  (`isWithinWindow` `:40-48`). Horas inválidas o fuera de 0..23 → inactivo (`:61-68`). Pura y
  determinista.

## Evidencia
- `modules/automation/src/exam-mode.ts:57-73`.
- Cableado en el bot, comando `/modo_examen [hora 0-23]`:
  `apps/bot/src/bot-update.service.ts:15451` (case, hora de `args[0]` o `new Date().getHours()`),
  `:15458` `rulesForExamMode(hourOfDay)`, respuesta 📝 en `:15459-15463`.
- Import: `apps/bot/src/bot-update.service.ts:114`.
- Tests: `modules/automation/src/exam-mode.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta desde `/modo_examen`, pero el comando es **diagnóstico**: dice si
el modo estaría activo a esa hora y qué categorías se bloquearían; no aplica el silencio real de
juegos/memes/enlaces en el grupo. El `options?.start/end` de la ventana no se pasa desde el comando
(usa siempre el default 8..14).

## Preguntas abiertas
- ¿Se persiste una ventana de examen por chat y se aplica automáticamente el bloqueo? No observable
  desde el módulo (comando siempre con ventana por defecto) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Modo Evento Manual]], [[Reglas por Franja Horaria]], [[Comando schedulerule]]
