---
id: modryva-command-fantasmas
title: Comando fantasmas
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
  - "/fantasmas"
  - "/miembros_inactivos"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /fantasmas

## Propósito
Detecta miembros silenciosos. `/fantasmas` lista quienes entraron hace +24h y nunca escribieron (más la
"curva de silencio": mediana hasta el primer mensaje). `/miembros_inactivos` lista miembros que dejaron de
escribir en la ventana reciente.

## Comandos cubiertos
| Comando | Handler (case) | Qué calcula |
|---|---|---|
| `/fantasmas` | `bot-update.service.ts:17193` | `findGhostMembers` (gracia 24h) + `computeSilenceCurve` cruzando `new_member` vs `message`. |
| `/miembros_inactivos` | `bot-update.service.ts:17461` | `detectDormantMembers` sobre el último visto por usuario. |

## Sintaxis
`/fantasmas` · `/miembros_inactivos` (sin argumentos).

## Permisos
Ninguno especial. No requiere bot admin (solo lee actividad registrada).

## Implementación
`handleDataReportsCommand` (`apps/bot/src/bot-update.service.ts:16773`). `/fantasmas` hace dos lecturas en
paralelo: `listRecent(...,"new_member",500)` y `listRecent(...,"message",500)`. Descripciones en
`apps/bot/src/poller.ts:126` y `:106`.

## Modelos que toca
Solo lectura sobre [[Modelo ChatActivity]] (tipos `new_member` y `message`). No escribe ni audita.

## Eventos
Ninguno (solo lectura).

## Errores / edge-cases
"No hay entradas de miembros registradas" si no hay eventos `new_member`. Requiere que el bot vea entradas
y mensajes para poblar el log.

## Tests
`modules/community/**` (`findGhostMembers`, `computeSilenceCurve`, `detectDormantMembers`) +
`apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Consume: [[Modelo ChatActivity]]
- Relacionado con: [[Comando mapa_calor]], [[Comando novatos]]
