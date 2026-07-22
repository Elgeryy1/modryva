---
id: modryva-command-temas_emergentes
title: Comando temas_emergentes
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
  - "/temas_emergentes"
  - "/temas_inactivos"
  - "/crossposting"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /temas_emergentes

## Propósito
Analítica de **temas de foro** (topics) del grupo, solo lectura. Detecta qué temas despegan o se apagan,
cuáles llevan días inactivos y si se está copiando el mismo mensaje entre temas (crossposting).

## Comandos cubiertos
| Comando | Handler (case) | Qué calcula |
|---|---|---|
| `/temas_emergentes` | `bot-update.service.ts:17083` | Ventana 48h: `detectEmergingTopics` (x2) y `detectDeadTopics`. |
| `/temas_inactivos [dias]` | `bot-update.service.ts:17146` | `detectIdleTopics` con `deadAfterMs = dias*24h` (por defecto 7). |
| `/crossposting` | `bot-update.service.ts:17053` | `detectCrossposting`: mismo texto repetido en >1 tema de foro. |

## Sintaxis
`/temas_emergentes` · `/temas_inactivos [días]` · `/crossposting`. Requieren que el grupo use temas de foro.

## Permisos
Ninguno especial (cualquier miembro). No requiere bot admin (solo lee actividad registrada).

## Implementación
`handleDataReportsCommand` (`apps/bot/src/bot-update.service.ts:16773`). Lee
`chatActivityRepository.listRecent(...,"message",500)` y agrupa por `entry.topic`. Descripciones en
`apps/bot/src/poller.ts:134`, `:130`, `:138`.

## Modelos que toca
Solo lectura sobre [[Modelo ChatActivity]] (campo `topic`). No escribe ni audita.

## Eventos
Ninguno (solo lectura).

## Errores / edge-cases
"No hay actividad por temas" si ningún mensaje registrado tiene `topic` (grupo sin foros). Sin resultados
devuelve mensajes de "sin temas emergentes / ningún tema inactivo".

## Tests
`modules/community/**` (funciones puras de detección) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Consume: [[Modelo ChatActivity]]
- Relacionado con: [[Comando mapa_calor]], [[Comando fantasmas]]
