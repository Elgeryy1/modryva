---
id: modryva-games-coop-boss
title: Jefe Cooperativo
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/boss-progress.ts
  - modules/games/src/collective-rewards.ts
  - apps/api/src/games/games.service.ts
tags:
  - modryva
  - feature
  - games
aliases: [boss, "coop boss", "jefe de grupo"]
created: 2026-07-12
updated: 2026-07-12
---

# Jefe Cooperativo

## Qué hace
Un jefe compartido por el grupo al que se le baja la vida con **un ataque por miembro y día** (daño fijo). Al derrotarlo aparece uno más duro y se anuncia una recompensa colectiva para todos. La barra de vida se calcula con lógica pura; el estado (nivel/meta/hecho) vive en `ChatSetting` y las contribuciones por miembro en `ChatActivityEvent` (0 migraciones).

## Evidencia
- Progreso puro: `computeBossProgress({done, goal})` (`modules/games/src/boss-progress.ts:44-51`) devuelve `percent` (0..100), `defeated` (`done>=goal`) y `remaining` (nunca negativo).
- Recompensa compartida: `computeCollectiveReward(input, options)` (`modules/games/src/collective-rewards.ts:57-74`) reparte la misma recompensa a cada miembro y arma el mensaje en español; ver [[Recompensas Colectivas]].
- Orquestación (`apps/api/src/games/games.service.ts`):
  - Constantes: `BOSS_HIT_DAMAGE = 8`, `BOSS_BASE_GOAL = 50`, `BOSS_GOAL_STEP = 30` (`games.service.ts:123-125`); `BOSS_ROSTER` de 5 jefes (`games.service.ts:127-133`); recompensa `50 + level*10` (`games.service.ts:144`).
  - `coopBoss` (`games.service.ts:644-660`) y `bossStatus` (`games.service.ts:584-641`): agregan el daño por contribuyente (topic `boss:<level>`) y marcan `youAttackedToday`.
  - `attackBoss` (`games.service.ts:667-769`): una vez al día (segundo ataque = no-op, L690-708); al superar la meta marca `justDefeated`, sube de nivel y calcula la recompensa (L728-741).
- Tests: `modules/games/src/boss-progress.test.ts`, `collective-rewards.test.ts`; `apps/api/src/games/games.service.test.ts`.
- Invocado en: `POST /v1/games/boss` y `/boss/attack` (`apps/api/src/games/games.controller.ts:125-144`).

## Estado / cableado
`implemented`. Se juega desde el hub de la Mini App (scope group con deep link `games_<gid>`). El gate diario reusa `findUserEvent(kind=boss_hit, messageId=dayKey)`.

## Preguntas abiertas
- El comentario del código lo llama "weekly boss" (`games.service.ts:118`, `boss-progress.ts:1`) pero no hay reset temporal: el jefe solo avanza por ataques acumulados; el ciclo es por derrota, no por semana.
- La UI (barra de vida, animación) vive en la Mini App (`apps/web`), no auditada aquí.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]], [[Recompensas Colectivas]]
- Relacionado con: [[Trivia Diaria de Grupo]], [[Reto Colectivo]], [[Ciudad Cooperativa]], [[Chip Economy]], [[Comando jugar]]
