---
id: modryva-community-mensajes-programados
title: Mensajes Programados
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/scheduling.ts
tags:
  - modryva
  - feature
  - community
aliases: [schedule, schedules, unschedule, publicaciones programadas]
created: 2026-07-12
updated: 2026-07-12
---

# Mensajes Programados

## Qué hace
Publicaciones diferidas por grupo: `/schedule <minutos> <mensaje>` programa un post (1 min a 43 200 min = 30 días), `/schedules` lista los pendientes y `/unschedule <id>` cancela uno.

## Evidencia
- `parseScheduleCommand` (`schedule`/`schedules`/`unschedule`) valida rango de minutos y texto (`modules/community/src/scheduling.ts:21-68`).
- `computeRunAtMs(nowMs, minutes) = nowMs + minutes*60000` (`scheduling.ts:70-71`).
- Test: `modules/community/src/scheduling.test.ts`.

## Estado / cableado
Implemented. `handleScheduleCommand` (`apps/bot/src/bot-update.service.ts:7444-7500+`): `list` lee `scheduledPostRepository.listPending`; `cancel` usa `scheduledPostRepository.cancel` con auditoría; crear exige permiso `schedule.config`. Imports en `bot-update.service.ts:157,256`.

## Preguntas abiertas
- Qué proceso entrega el post cuando llega su `runAt` (worker/cron) no se ve desde el bot → `unknown` (probable job en `apps/worker`).
- Nombre exacto del modelo tras `scheduledPostRepository` → `unknown` ([[Modelo ScheduledPost]] como ghost link).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]], [[Modelo ScheduledPost]]
- Relacionado con: [[Rituales]], [[Reglas por Horario]], [[Comando schedule]]
