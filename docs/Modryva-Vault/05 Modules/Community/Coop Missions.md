---
id: coop-missions
title: Coop Missions
type: feature
domain: community
status: implemented
maturity: beta
source: [modules/community/src/coop-missions.ts, apps/bot/src/bot-update.service.ts, packages/data/prisma/schema.prisma]
tags: [modryva, feature, community]
aliases: [misiones cooperativas, mision]
created: 2026-07-12
updated: 2026-07-12
---

# Coop Missions

Misiones cooperativas de grupo con progreso compartido y objetivo común. Lógica pura en `modules/community/src/coop-missions.ts`, persistencia en [[Modelo CoopMissionState]].

## Comando

`/mision` (alias `mision`), gestionado por `handleCoopMissionCommand` (`apps/bot/src/bot-update.service.ts:10347`), registrado como handler `coop-mission.command` (`bot-update.service.ts:1253`):

- `/mision` — muestra la misión activa y el progreso (`bot-update.service.ts:10424-10436`).
- `/mision set <objetivo> <descripción>` — crea una misión nueva (progreso 0). Requiere permiso `coopmission.write` (`bot-update.service.ts:10364-10388`).
- `/mision add [delta]` — suma progreso (delta por defecto 1); anuncia si se completa. Requiere permiso `coopmission.write` (`bot-update.service.ts:10390-10421`).

## Lógica pura

Todo el cálculo vive en `coop-missions.ts`, sin mutar la entrada:

- `addMissionProgress(mission, delta)` (`coop-missions.ts:80-96`): satura el progreso en `[0, goal]` y marca `completed: true` **solo** cuando esta llamada cruza el umbral (no cuando ya estaba completa).
- `missionPercent` (`coop-missions.ts:66-72`), `coopMissionRemaining` (`coop-missions.ts:54-60`), `coopMissionIsComplete` (`coop-missions.ts:43-48`).
- `streakBonus(consecutiveDays, cap)` (`coop-missions.ts:103-113`): bonus de racha diaria saturado por tope.

## Persistencia

Una misión por grupo: `CoopMissionRepository` (`getMission`/`setMission`) sobre [[Modelo CoopMissionState]] (unique `[tenantId, chatId]`).

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo CoopMissionState]]
- **Utilizado por**: [[Comando mision]] (`/mision`)
- **Relacionado con**: [[Gratitude Points]], [[Commands Map]]
