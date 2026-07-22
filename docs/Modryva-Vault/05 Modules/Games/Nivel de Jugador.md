---
id: modryva-games-player-level
title: Nivel de Jugador
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/player-level.ts
  - apps/api/src/games/games.service.ts
tags:
  - modryva
  - feature
  - games
aliases: ["player level", "nivel", levelForPoints]
created: 2026-07-12
updated: 2026-07-12
---

# Nivel de Jugador

## Qué hace
Deriva el nivel del jugador a partir de sus puntos acumulados, con progreso hacia el siguiente nivel. Curva creciente: alcanzar el nivel L cuesta `25·L·(L−1)` puntos (0, 50, 150, 300, 500, 750…), cada nivel un poco más caro que el anterior.

## Evidencia
- `levelForPoints(points)` (`modules/games/src/player-level.ts:23-35`): sanea puntos (`max(0, floor)`), busca el nivel más alto cuyo umbral no supera los puntos (cap `LEVEL_CAP = 999`, `player-level.ts:8`), y devuelve `{level, points, floor, ceil}` (umbrales del nivel actual y siguiente).
- Umbral interno: `thresholdFor(level) = 25*level*(level-1)` (`player-level.ts:11`).
- Consumo real: `GamesService.playerProfile` (`apps/api/src/games/games.service.ts:806-863`) llama a `levelForPoints(points)` (L839) y devuelve `level/levelFloor/levelCeil` en `PlayerHomeView` (L73-90, L847-862).
- Tests: `modules/games/src/player-level.test.ts`.
- Invocado en: `POST /v1/games/profile` (`apps/api/src/games/games.controller.ts:78-86`).

## Estado / cableado
`implemented`. Alimenta la pantalla "home" del jugador en la Mini App (nombre, puntos, nivel + barra, racha, rank global y top). Los puntos vienen del total global por usuario (`topPlayers`/`sumUserPoints`, `games.service.ts:817-838`).

## Preguntas abiertas
- Ninguna relevante; la curva es determinista y está testeada.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Racha de Juego]], [[Sesiones de Juego]], [[Modelo GameScore]]
