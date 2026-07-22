---
id: modryva-command-recordar
title: Comando recordar
type: command
domain: utility
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - utility
  - productivity
aliases:
  - "/remind"
  - "/reminders"
  - "/unremind"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /recordar (nativo: /remind)

## Propósito
Recordatorios personales. Programa un aviso que el worker dispara a la hora indicada. Acepta minutos o
lenguaje natural estilo Skeddy ("manana a las 9 llamar", "en 2 horas ...").

## Comandos cubiertos
| Comando | `kind` | Efecto |
|---|---|---|
| `/remind <min> <texto>` | create | Programa un recordatorio. |
| `/remind <texto natural>` | (fallback NL) | `parseNaturalReminder` si el parser estricto falla (`bot-update.service.ts:7099`). |
| `/reminders` | list | Lista tus pendientes. |
| `/unremind <id>` | cancel | Cancela uno. |

## Sintaxis
`/remind 30 llamar a Ana` · `/remind manana a las 9 ...` · `/reminders` · `/unremind <id>`.

## Permisos
Ninguno especial (cada usuario gestiona los suyos). No requiere bot admin.

## Implementación
`handleReminderCommand` (`apps/bot/src/bot-update.service.ts:7086`) vía `parseReminderCommand`. Crea con
`productivityRepository.createReminder`. El disparo lo hace el worker con el job repetible
`reminder.fire.due` (cada 60s).

## Modelos que toca
[[Modelo Reminder]] (`ProductivityRepository`).

## Eventos
`recordAudit` `reminder.created` (7120/7181).

## Errores / edge-cases
Fuera de grupo/DM válido pide contexto. "No existe ese recordatorio pendiente" al cancelar uno inexistente.

## Tests
`apps/bot/src/bot-update.service.test.ts` + `modules/**` (`parseNaturalReminder`, `reminderRunAtMs`).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Job reminder]]
- Produce: [[Modelo Reminder]]
- Relacionado con: [[Comando afk]], [[Comando tickets]]
