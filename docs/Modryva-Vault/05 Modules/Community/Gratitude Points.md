---
id: gratitude-points
title: Gratitude Points
type: feature
domain: community
status: implemented
maturity: beta
source: [apps/bot/src/bot-update.service.ts, packages/data/prisma/schema.prisma]
tags: [modryva, feature, community]
aliases: [gratitud, gracias, topgracias, puntos de gratitud]
created: 2026-07-12
updated: 2026-07-12
---

# Gratitude Points

Sistema de "puntos de gratitud": los miembros agradecen a otros respondiendo con `/gracias`, y hay un ranking. Persistencia en [[Modelo GratitudePoint]].

## Comandos

Handler `handleGratitudeCommand` (`apps/bot/src/bot-update.service.ts:10439`), registrado como `gratitude.command` (`bot-update.service.ts:1258`):

- `/gracias` — en respuesta a un mensaje, suma `GRATITUDE_PER_THANKS` puntos al autor original con `grantGratitude` (`bot-update.service.ts:10483-10495`); sin respuesta, muestra los puntos propios (`bot-update.service.ts:10505-10512`).
- `/topgracias` — ranking del grupo, con `gratitudeRepository.top` + `rankGratitude` (`bot-update.service.ts:10455-10460`).

Los helpers `grantGratitude` y `rankGratitude` se importan del paquete community (`bot-update.service.ts:349,355`).

## Persistencia

`GratitudeRepository` (`getPoints`/`setPoints`/`top`) sobre [[Modelo GratitudePoint]] con unique `[tenantId, chatId, userTelegramId]` — puntos por usuario dentro de cada grupo.

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo GratitudePoint]]
- **Utilizado por**: [[Comando gracias]] (`/gracias`)
- **Relacionado con**: [[Coop Missions]], [[Commands Map]]
