---
id: polls
title: Polls
type: feature
domain: community
status: implemented
maturity: stable
source: [modules/community/src/polls.ts, apps/bot/src/bot-update.service.ts, packages/data/prisma/schema.prisma]
tags: [modryva, feature, community]
aliases: [encuestas, poll]
created: 2026-07-12
updated: 2026-07-12
---

# Polls

Encuestas de grupo con botones inline y recuento por opción. Lógica pura en `modules/community/src/polls.ts`; persistencia en [[Modelo Poll]] + [[Modelo PollVote]].

## Comando y voto

- Crear: `/poll Pregunta | Opción 1 | Opción 2 [| Opción 3 ...]` (2-10 opciones). Parser `parsePollCommand` (`polls.ts:25-48`), handler `poll.command` (`apps/bot/src/bot-update.service.ts:1368`); crea la fila con `pollRepository.createPoll` (`bot-update.service.ts:7649`).
- Votar: callback `poll:<pollId>:<optionIndex>`, parseado por `parsePollVote` (`polls.ts:96-111`), handler `poll.vote` (`bot-update.service.ts:1373`). El voto se registra con `pollRepository.recordVote` (`bot-update.service.ts:7701`).

## Recuento y render

- `tallyVotes(votes, optionCount)` (`polls.ts:58-75`): cuenta por opción e **ignora índices fuera de rango**, de modo que un callback manipulado no corrompe el recuento.
- `formatPollResults(question, options, tally)` (`polls.ts:77-90`): render con porcentaje por opción y total.

## Persistencia

[[Modelo Poll]] guarda `question`, `options` (JSON), `closed`. Los votos van a [[Modelo PollVote]] con unique `[pollId, telegramUserId]` (un voto por usuario y encuesta).

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo Poll]], [[Modelo PollVote]]
- **Utilizado por**: [[Comando poll]] (`/poll`)
- **Relacionado con**: [[Custom Commands]], [[Commands Map]], [[Events Map]]
