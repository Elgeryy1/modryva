---
id: giveaways
title: Giveaways
type: feature
domain: community
status: implemented
maturity: stable
source: [modules/community/src/giveaways.ts, apps/bot/src/bot-update.service.ts, packages/data/prisma/schema.prisma]
tags: [modryva, feature, community]
aliases: [sorteos, giveaway, gdraw]
created: 2026-07-12
updated: 2026-07-12
---

# Giveaways

Sorteos de grupo con botón para participar y ganador **verificable**. Lógica pura en `modules/community/src/giveaways.ts`; persistencia en [[Modelo Giveaway]] + [[Modelo GiveawayEntry]].

## Comandos y participación

Parser `parseGiveawayCommand` (`giveaways.ts:21-49`), handler `giveaway.command` (`apps/bot/src/bot-update.service.ts:1377`):

- `/giveaway <premio>` — crea un sorteo con botón (`giveawayRepository.createGiveaway`, `bot-update.service.ts:7519`; requiere `config.write`, `docs/COMMANDS.md:287`).
- `/gdraw <giveaway_id>` — cierra el sorteo y sortea ganador (`closeWithWinner`, `bot-update.service.ts:7577`).
- Participar: callback `giveaway:<id>`, parseado por `parseGiveawayJoin` (`giveaways.ts:51-60`), handler `giveaway.join` (`bot-update.service.ts:1382`); registra la entrada con `giveawayRepository.addEntry` (`bot-update.service.ts:7616`).

## Ganador reproducible

- `hashSeed(seed)` (`giveaways.ts:66-73`): hash FNV-1a de 32 bits del seed anunciado.
- `pickWinner(participants, seed)` (`giveaways.ts:79-90`): ordena los participantes ascendente y elige el índice `hashSeed(seed) % count`. Cualquiera con el seed y la lista puede **verificar** el resultado.

## Persistencia

[[Modelo Giveaway]] (`prize`, `status`, `seed`, `winnerTelegramId`) y [[Modelo GiveawayEntry]] con unique `[giveawayId, telegramUserId]` (una entrada por usuario).

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo Giveaway]], [[Modelo GiveawayEntry]]
- **Utilizado por**: [[Comando giveaway]] (`/giveaway`)
- **Relacionado con**: [[Polls]], [[Commands Map]]
