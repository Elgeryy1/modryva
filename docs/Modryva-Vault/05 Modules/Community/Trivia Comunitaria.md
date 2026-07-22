---
id: trivia-comunitaria
title: Trivia Comunitaria
type: feature
domain: community
status: implemented
maturity: beta
source: [apps/worker/src/trivia-announce-processor.ts, apps/worker/src/server.ts, packages/shared/src/games-config.ts]
tags: [modryva, feature, community]
aliases: [trivia, daily trivia, games.trivia.announce]
created: 2026-07-12
updated: 2026-07-12
---

# Trivia Comunitaria

Trivia diaria/horaria para el grupo, jugada dentro del Mini App. Es un "juego de comunidad", pero **su código no está en `modules/community`**: la lógica de juego vive en `@superbot/module-games` y el anuncio al grupo en el worker `apps/worker/src/trivia-announce-processor.ts`. Se documenta aquí por su rol comunitario; ver también el dominio Games.

## Job de anuncio

`games.trivia.announce` (`apps/worker/src/server.ts:64`) → `processTriviaAnnouncements` (`trivia-announce-processor.ts:65`). Para cada grupo que ha optado (config con `announce` + `games.dailytrivia` activos), publica una tarjeta "¡Nueva trivia!" con un botón al Mini App la primera vez que se abre una ventana nueva (`trivia-announce-processor.ts:82-153`).

## Opt-in y config

Se lee de la `ChatSetting` `games_config` (`GAMES_CONFIG_KEY`, `packages/shared/src/games-config.ts:14`), parseada con `parseGamesConfig`. Cadencia `hourly`/`daily` (`TriviaCadence`). Ventanas en buckets UTC para que todos compartan la misma pregunta (`trivia-announce-processor.ts:13-15,38-41`).

## Idempotencia

Marcador `{ lastWindow }` en la `ChatSetting` `games_announce_state` (`GAMES_ANNOUNCE_STATE_KEY`, `games-config.ts:16`). La primera vez siembra la ventana sin publicar; luego anuncia una vez por ventana (`trivia-announce-processor.ts:96-116`).

## Alcance v1

Solo el tenant del bot primario, porque el botón es un deep link a un Mini App con nombre (`t.me/<bot>/<app>?startapp=game_dailytrivia_<gid>`); los bots hijos son un follow-up (`trivia-announce-processor.ts:61-63,91-94`). Requiere URL pública https (`trivia-announce-processor.ts:75-77`).

## Relaciones

- **Pertenece a**: [[Modules Map]] (dominio Games; referenciada desde [[Módulo community]])
- **Depende de**: [[Modelo ChatSetting]], `@superbot/module-games`, `@superbot/shared`
- **Produce**: [[Job games.trivia.announce]]
- **Relacionado con**: [[Recap Semanal]], [[Events Map]]
