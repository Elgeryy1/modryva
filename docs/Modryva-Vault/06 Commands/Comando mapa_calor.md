---
id: modryva-command-mapa_calor
title: Comando mapa_calor
type: command
domain: community
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/poller.ts
tags:
  - modryva
  - command
  - community
  - analytics
aliases:
  - "/mapa_calor"
  - "/participacion"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /mapa_calor

## Propósito
Analítica de actividad del grupo (solo lectura). `/mapa_calor` dibuja un mapa de calor de mensajes por
hora del día; `/participacion` mide el equilibrio de participación (índice de Gini, quién acapara la charla,
voces más calladas).

## Comandos cubiertos
| Comando | Handler (case) | Qué calcula |
|---|---|---|
| `/mapa_calor [tz_offset_min]` | `bot-update.service.ts:16902` | Heatmap por hora sobre los últimos 500 mensajes; marca la hora punta. |
| `/participacion` | `bot-update.service.ts:16929` | Gini de participación, monopolio (`detectMonopoly` umbral 0.4), voces calladas (`suggestQuietVoices`). |

## Sintaxis
`/mapa_calor` o `/mapa_calor <offset_minutos>` (ej. `/mapa_calor 120` para UTC+2). `/participacion` sin args.

## Permisos
Ninguno especial (cualquier miembro). No requiere que el bot sea admin (solo lee la actividad ya registrada).

## Implementación
Despachado por `handleDataReportsCommand` (`apps/bot/src/bot-update.service.ts:16773`, registrado como
`data-reports.command` en `botHandlers()` línea 1593). Lee de `chatActivityRepository.listRecent(...,"message",500)`.
Descripciones canónicas en `apps/bot/src/poller.ts:110` y `:114`.

## Modelos que toca
Solo lectura sobre [[Modelo ChatActivity]] (log de actividad). No escribe nada ni audita.

## Eventos
Ninguno (comando de solo lectura; no llama a `recordAudit`).

## Errores / edge-cases
"Aún no hay actividad registrada" si el log está vacío. El offset se valida con `/^-?\d{1,4}$/` (si no, UTC).

## Tests
`apps/bot/src/bot-update.service.test.ts` (suite del servicio). Lógica pura en `modules/community/**`
(`buildActivityHeatmap`, `participationGini`, `detectMonopoly`). Confirmar test específico del case.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Consume: [[Modelo ChatActivity]]
- Relacionado con: [[Comando fantasmas]], [[Comando temas_emergentes]], [[Security Map]]
