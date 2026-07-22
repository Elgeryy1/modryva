---
id: modryva-command-poll
title: Comando poll
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
  - "/poll"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /poll

## Propósito
Encuesta con botones inline y recuento verificable. A diferencia de `/quiz`, no tiene respuesta correcta.

## Sintaxis
`/poll Pregunta | Opción 1 | Opción 2 [| ...]` (2-10 opciones).

## Permisos
Ninguno especial (cualquier miembro dentro del grupo). No requiere bot admin.

## Implementación
`handlePollCommand` (`apps/bot/src/bot-update.service.ts:7630`) vía `parsePollCommand`. Publica con teclado
inline (callback `poll:<id>:<i>`). Cada voto lo procesa `handlePollVote` (7677): un voto por usuario
(modificable), descarta índices fuera de rango, y responde con recuento y porcentajes (`tallyVotes`,
`formatPollResults`).

## Modelos que toca
[[Modelo Poll]] y [[Modelo PollVote]] (`pollRepository`).

## Eventos
`recordAudit` `poll.created` (7660) y `poll.voted` (7712).

## Errores / edge-cases
"Esta encuesta no está disponible" si cerrada; "Opción inválida" fuera de rango. Fuera de grupo pide grupo.

## Tests
`apps/bot/src/bot-update.service.test.ts` (creación, voto único modificable, recuento).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]]
- Produce: [[Modelo Poll]], [[Modelo PollVote]]
- Relacionado con: [[Comando giveaway]], [[Comando trivia]]
