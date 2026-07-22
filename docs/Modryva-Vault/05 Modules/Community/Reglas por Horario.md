---
id: modryva-community-reglas-horario
title: Reglas por Horario
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/scheduled-rules.ts
tags:
  - modryva
  - feature
  - community
aliases: [schedulerule, ventanas estrictas, modo examen, moderacion por hora]
created: 2026-07-12
updated: 2026-07-12
---

# Reglas por Horario

## Qué hace
Ventanas de moderación por hora del día: un grupo puede ser más estricto de noche o en un "modo examen". Cada regla cubre un rango horario semiabierto `[startHour, endHour)` en reloj de 24h (soporta cruce de medianoche) con un flag `strict`. `/schedulerule <inicio> <fin> on|off` la configura.

## Evidencia
- `TimeRule { startHour, endHour, strict }`; `isTimeRuleActive` soporta cruce de medianoche y `start === end` como todo el día (`modules/community/src/scheduled-rules.ts:18-51`).
- `activeTimeRule` (prioridad por orden) e `isStrictAtHour` (`scheduled-rules.ts:58-77`); `formatTimeRuleWindow` → `"22:00-06:00"` (`scheduled-rules.ts:83-86`).
- `parseScheduledRuleCommand` valida horas 0-23 y toggle on/off (`scheduled-rules.ts:125-171`).
- Test: `modules/community/src/scheduled-rules.test.ts`.

## Estado / cableado
Implemented. Handler `parseScheduledRuleCommand` en `apps/bot/src/bot-update.service.ts:10988`. `isStrictAtHour`/`formatTimeRuleWindow` se importan (`bot-update.service.ts:197,212,303,257`) para que el flujo de moderación ambiente aplique la política estricta a la hora activa.

## Preguntas abiertas
- Con qué zona horaria se evalúa la hora activa y dónde se persisten las `TimeRule` por grupo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Quiet Mode]], [[Rituales]], [[Mensajes Programados]], [[Comando schedulerule]]
