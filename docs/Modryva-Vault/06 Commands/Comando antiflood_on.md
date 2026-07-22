---
id: modryva-command-antiflood_on
title: Comando antiflood_on
type: command
domain: moderation
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - docs/COMMANDS.md
tags:
  - modryva
  - command
  - moderation
  - antispam
aliases:
  - "/antiflood_on"
  - "/antiflood_off"
  - "/antiflood_limit"
  - "/antiflood_action"
  - "/antiflood_status"
  - "/antiflood_test"
  - "/antiflood"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /antiflood_on

## Propósito
Gestiona el módulo antiflood del grupo: activar/desactivar, ajustar el límite de mensajes por ventana y la
acción de castigo. `/antiflood_on` es el atajo de activación.

## Comandos cubiertos
| Comando | `kind` | Efecto |
|---|---|---|
| `/antiflood` | help | Ayuda del módulo. |
| `/antiflood_status` | status | Config actual. |
| `/antiflood_test` | test | Simula el límite sin sancionar (`evaluateFlood`). |
| `/antiflood_on` `/antiflood_off` | enable | Activa/desactiva. |
| `/antiflood_limit <n> [seg]` | limit | Límite de mensajes / ventana. |
| `/antiflood_action <ignore\|delete\|warn\|mute\|ban>` | action | Castigo al superar el límite. |

## Sintaxis
Ver tabla. Detalle en `docs/COMMANDS.md` (sección Antiflood).

## Permisos
`help`/`status`/`test` abiertos. `on/off/limit/action` requieren `antiflood.config`
(`ensureConfigPermission`, `bot-update.service.ts:13335`) — admins. El **enforcement** en tiempo real
(`handleAntifloodMessage`, 13380) exime a admins y, para `mute`/`ban`, **necesita bot admin**.

## Implementación
`handleAntifloodCommand` (`apps/bot/src/bot-update.service.ts:13286`) vía `parseAntifloodCommand`,
registrado en `botHandlers()`. El conteo usa `floodCounter` (ventana deslizante) y `evaluateFlood`.

## Modelos que toca
[[Modelo AntifloodConfig]] (`antifloodRepository.upsertConfig`) y [[Modelo AntifloodEvent]] al sancionar;
`Sanction` cuando la acción es mute/ban.

## Eventos
`recordAudit` `antiflood.config.updated` (13368); `antifloodRepository.recordEvent` al disparar (13418).

## Errores / edge-cases
Fuera de grupo: "El antiflood se configura dentro de un grupo". Sin permisos de bot, mute/ban se registran
pero Telegram puede rechazarlos.

## Tests
`modules/security/**` (`evaluateFlood`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo security]]
- Produce: [[Modelo AntifloodConfig]], [[Modelo AntifloodEvent]]
- Relacionado con: [[Comando config]], [[Comando copia_pega]], [[Security Map]]
