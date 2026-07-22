---
id: modryva-command-tickets
title: Comando tickets
type: command
domain: admin
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - docs/COMMANDS.md
tags:
  - modryva
  - command
  - support
aliases:
  - "/ticket"
  - "/tickets"
  - "/ticketclose"
  - "/ticketreopen"
  - "/ticketassign"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /tickets

## Propósito
Soporte por tickets dentro del grupo. Cada ticket lleva número correlativo por tenant, estado
(open/assigned/closed), reportante y agente.

## Comandos cubiertos
| Comando | `kind` | Permiso |
|---|---|---|
| `/ticket [prioridad] <asunto>` | create | — (cualquier miembro) |
| `/tickets` | list | — |
| `/ticketclose <id>` | close | moderation.write |
| `/ticketreopen <id>` | reopen | moderation.write |
| `/ticketassign <id> <user>` | assign | moderation.write |

Prioridades: `low, normal, high, urgent`.

## Sintaxis
Ver tabla. Detalle en `docs/COMMANDS.md` (Soporte y tickets).

## Permisos
Crear/listar: abierto. Cerrar/reabrir/asignar: `moderation.write` vía `evaluatePolicy`
(`bot-update.service.ts:7339`, módulo `support`).

## Implementación
`handleTicketCommand` (`apps/bot/src/bot-update.service.ts:7262`) vía `parseTicketCommand`. Al crear, emite
ruta de red de dueño `tickets` (`emitOwnerNetworkRoute`, 7302).

## Modelos que toca
[[Modelo Ticket]] y [[Modelo TicketMessage]] (`ticketRepository`).

## Eventos
`recordAudit` `ticket.created` (7296), `ticket.assigned` (7369), `ticket.closed`/`ticket.reopened` (7385).

## Errores / edge-cases
"Ticket no encontrado". Sin permisos: "No tienes permisos para gestionar tickets". Fuera de grupo pide grupo.

## Tests
`apps/bot/src/bot-update.service.test.ts` (ciclo de vida del ticket).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo support]]
- Produce: [[Modelo Ticket]], [[Modelo TicketMessage]]
- Relacionado con: [[Comando config]], [[Comando recordar]]
