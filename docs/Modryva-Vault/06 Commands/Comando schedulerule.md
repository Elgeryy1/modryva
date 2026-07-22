---
id: modryva-command-schedulerule
title: Comando schedulerule
type: command
domain: moderation
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/poller.ts
tags:
  - modryva
  - command
  - moderation
  - config
aliases:
  - "/schedulerule"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /schedulerule

## Propósito
Configura **ventanas de moderación estricta por horario** (opt-in). En una ventana estricta, el bot borra
los enlaces publicados por no-admins (p. ej. "modo noche"). Conservador: solo enlaces, nada más.

## Sintaxis
`/schedulerule` o `/schedulerule list` (ver) · `/schedulerule <inicio> <fin> <estricto>` (añadir ventana) ·
`/schedulerule clear` (borrar todas). Horas en UTC.

## Permisos
`list` abierto. Añadir/`clear` requieren `scheduled-rules.config` (`ensureConfigPermission`,
`bot-update.service.ts:10920`) — admins. El enforcement (`handleScheduledStrictMode`, 10976) **requiere que
el bot sea admin** para borrar enlaces.

## Implementación
`handleScheduledRuleCommand` (`apps/bot/src/bot-update.service.ts:10887`; sale si
`command.name !== "schedulerule"`), registrado como `scheduled-rules.config` (línea 1446). Persistencia en
`ChatSetting` clave `schedule_rules` (array de `TimeRule`). `isStrictAtHour`/`formatTimeRuleWindow` calculan
el estado. Descripción en `apps/bot/src/poller.ts:147`.

## Modelos que toca
[[Modelo ChatSetting]] (clave `schedule_rules`).

## Eventos
No emite `recordAudit` en este handler (escribe directamente el `ChatSetting`).

## Errores / edge-cases
Fuera de grupo pide usarlo en grupo. Uso inválido devuelve el `usage` de `parseScheduledRuleCommand`.

## Tests
`modules/**` (`isStrictAtHour`, `parseScheduledRuleCommand`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]]
- Produce: [[Modelo ChatSetting]]
- Relacionado con: [[Comando fase_dia]], [[Comando config]], [[Security Map]]
