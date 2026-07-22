---
id: modryva-command-fase_dia
title: Comando fase_dia
type: command
domain: utility
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/poller.ts
tags:
  - modryva
  - command
  - utility
aliases:
  - "/fase_dia"
  - "/horario"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /fase_dia

## Propósito
Utilidades "asistente" que responden según la hora actual, sin persistencia. `/fase_dia` recomienda el
rigor de moderación por franja horaria; `/horario` informa del estado del horario de soporte.

## Comandos cubiertos
| Comando | Handler (case) | Salida |
|---|---|---|
| `/fase_dia` | `bot-update.service.ts:14810` | `rulesForDayPhase(hora)` → fase + nivel de rigor. |
| `/horario` | `bot-update.service.ts:14816` | `supportHoursStatus(hora)` → mensaje de estado. |

## Sintaxis
`/fase_dia` · `/horario` (sin argumentos). Nota: el mismo handler también sirve `/rango_accion` y `/permiso`.

## Permisos
Ninguno. Funciones puras sobre `new Date().getHours()`; no leen ni escriben datos.

## Implementación
`handleUtilityPlusCommand` (`apps/bot/src/bot-update.service.ts:14784`, switch por `command.name`),
registrado como `utility-plus.command` (línea 1589). Descripciones en `apps/bot/src/poller.ts:71`, `:72`.

## Modelos que toca
Ninguno (respuesta calculada en memoria).

## Eventos
Ninguno.

## Errores / edge-cases
Sin edge-cases de datos; dependen solo de la hora del servidor (UTC del proceso).

## Tests
`modules/**` (funciones `rulesForDayPhase`, `supportHoursStatus`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]]
- Relacionado con: [[Comando schedulerule]], [[Security Map]]
