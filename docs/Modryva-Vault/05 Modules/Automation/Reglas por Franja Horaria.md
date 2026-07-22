---
id: modryva-automation-reglas-por-franja-horaria
title: Reglas por Franja Horaria
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/day-phase-rules.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - rulesForDayPhase
  - DayPhase
created: 2026-07-12
updated: 2026-07-12
---

# Reglas por Franja Horaria

## Qué hace
Mapea la hora del día a una franja y a un rigor de moderación recomendado.
`rulesForDayPhase(hourOfDay)` → `{ phase, strictness }` (`day-phase-rules.ts:25-37`):

- Franjas y rigor: `madrugada` (0-5) → `estricto`; `manana` (6-11) → `suave`; `tarde` (12-18) →
  `normal`; `noche` (19-23) → `estricto` (`:25-37`).
- La hora se aplana y se envuelve a 0..23 (`((floor(h) % 24) + 24) % 24`), así cualquier entero es
  seguro (`:26`). Pura y determinista.

## Evidencia
- `modules/automation/src/day-phase-rules.ts:25-37`.
- Cableado en el bot, comando `/fase_dia`:
  `apps/bot/src/bot-update.service.ts:14864` (case), `:14865`
  `rulesForDayPhase(new Date().getHours())`, respuesta 🕐 en `:14866-14868`.
- Import: `apps/bot/src/bot-update.service.ts:113`.
- Tests: `modules/automation/src/day-phase-rules.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta desde `/fase_dia`, que es **diagnóstico**: reporta la franja y el
rigor sugeridos para la hora actual; no cambia por sí mismo la configuración de moderación. El `new
Date().getHours()` sí introduce el reloj real, pero solo para el reporte. Para ventanas de moderación
estricta realmente aplicadas, ver [[Comando schedulerule]].

## Preguntas abiertas
- ¿Algún módulo consume `strictness` para endurecer moderación automáticamente por franja? No se
  observa (única invocación = el comando diagnóstico) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Modo Examen]], [[Modo Evento Manual]], [[Comando schedulerule]]
