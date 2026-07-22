---
id: modryva-command-invites
title: Comando invites
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - modules/community/src/invites.ts
tags:
  - modryva
  - command
  - community
aliases:
  - "/invites"
  - "/inviters"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /invites

## Propósito
Referidos del grupo. `/invites` muestra a cuántos miembros has invitado tú; `/inviters` muestra el ranking
top 10 de invitadores.

## Comandos cubiertos
| Comando | `kind` | Salida |
|---|---|---|
| `/invites` | self | Tu número de invitados (`inviteRepository.getCount`). |
| `/inviters` | top | Top 10 invitadores (`inviteRepository.topInviters`). |

Mapeo en `modules/community/src/invites.ts:28` (`inviters` → `top`, resto → `self`).

## Sintaxis
`/invites` · `/inviters` (sin argumentos, dentro del grupo).

## Permisos
Ninguno especial (cualquier miembro). No requiere bot admin, pero el crédito de invitados solo se registra
si el bot ve las altas de nuevos miembros.

## Implementación
`handleInviteCommand` (`apps/bot/src/bot-update.service.ts:7801`) vía `parseInviteCommand`. El crédito se
graba en `recordInvites` (`bot-update.service.ts:7838`) al detectar altas (`countInvitedMembers`, excluye
auto-altas).

## Modelos que toca
[[Modelo InviteStat]] (contador por invitador/chat).

## Eventos
`recordAudit` `invite.recorded` (system, 7862) al acreditar invitaciones.

## Errores / edge-cases
"Aún no hay invitaciones registradas" si vacío. "No puedo identificarte" sin `userId`.

## Tests
`modules/community/src/invites.test.ts` + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Produce: [[Modelo InviteStat]]
- Relacionado con: [[Comando stats]], [[Comando top]]
