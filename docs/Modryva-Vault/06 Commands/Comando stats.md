---
id: modryva-command-stats
title: Comando stats
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - modules/community/src/analytics.ts
tags:
  - modryva
  - command
  - community
  - analytics
aliases:
  - "/stats"
  - "/activity"
  - "/topposters"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /stats

## Propósito
Estadísticas de actividad del grupo. `/stats` da totales (hoy, 7 días, usuarios activos, top 3);
`/activity` detalla mensajes por día (últimos 7); `/topposters` lista el ranking de quien más escribe.

## Comandos cubiertos
| Comando | `kind` | Salida |
|---|---|---|
| `/stats` | `summary` | Total, hoy, últimos 7 días, usuarios activos y top 3 posters. |
| `/activity` | `activity` | Mensajes por día (últimos 7). |
| `/topposters` | `top` | `formatTopPosters` (top 10). |

Mapeo de nombre → `kind` en `modules/community/src/analytics.ts:31` (`activity`/`stats`/resto = `top`);
nombres aceptados en `analytics.ts:15-16`.

## Sintaxis
`/stats` · `/activity` · `/topposters` (sin argumentos, dentro del grupo).

## Permisos
Ninguno especial (cualquier miembro). No requiere bot admin.

## Implementación
`handleStatsCommand` (`apps/bot/src/bot-update.service.ts:7722`) vía `parseStatsCommand`. Lee de
`analyticsRepository` (`getTotal`, `getRecentDays`, `getTopPosters`, `getActiveUserCount`). La actividad se
alimenta en `recordActivity` (`bot-update.service.ts:7777`) por cada mensaje.

## Modelos que toca
Solo lectura sobre [[Modelo ActivityDaily]] y [[Modelo UserActivity]] (poblados por `recordActivity`).

## Eventos
Ninguno en la consulta (la escritura ocurre en `recordActivity`, no en el comando).

## Errores / edge-cases
"Aún no hay actividad registrada" si el log está vacío.

## Tests
`modules/community/src/analytics.test.ts` (parser y formato) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Consume: [[Modelo ActivityDaily]], [[Modelo UserActivity]]
- Relacionado con: [[Comando top]], [[Comando salonfama]], [[Comando mapa_calor]]
