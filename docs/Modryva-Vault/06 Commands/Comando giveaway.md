---
id: modryva-command-giveaway
title: Comando giveaway
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - community
aliases:
  - "/giveaway"
  - "/gdraw"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /giveaway

## Propósito
Sorteos con botón de participación y ganador **verificable**. `/giveaway <premio>` crea el sorteo;
`/gdraw <id>` sortea un ganador reproducible.

## Comandos cubiertos
| Comando | `kind` | Efecto |
|---|---|---|
| `/giveaway <premio>` | create | Crea el sorteo con botón "Participar". |
| `/gdraw <id>` | draw | Elige ganador (`pickWinner` con semilla publicada). |

Participar es un callback `giveaway:<id>` (un registro por usuario, `handleGiveawayJoin`, 7597).

## Sintaxis
`/giveaway <premio>` · `/gdraw <id>`.

## Permisos
`create` requiere `giveaway.create`; `draw` requiere `giveaway.draw` (`ensureConfigPermission`,
`bot-update.service.ts:7508`/`7545`) — admins.

## Implementación
`handleGiveawayCommand` (`apps/bot/src/bot-update.service.ts:7489`) vía `parseGiveawayCommand`. El ganador se
elige con una semilla `randomUUID()` que se **publica** para reproducir el resultado (`closeWithWinner`).

## Modelos que toca
[[Modelo Giveaway]] y [[Modelo GiveawayEntry]] (`giveawayRepository`).

## Eventos
`recordAudit` `giveaway.created` (7527), `giveaway.drawn` (7581), `giveaway.joined` (7620).

## Errores / edge-cases
"Sorteo no encontrado", "ya fue resuelto", "no tiene participantes". Fuera de grupo pide grupo.

## Tests
`apps/bot/src/bot-update.service.test.ts` (creación, participación y sorteo verificable).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]]
- Produce: [[Modelo Giveaway]], [[Modelo GiveawayEntry]]
- Relacionado con: [[Comando poll]], [[Comando trivia]]
