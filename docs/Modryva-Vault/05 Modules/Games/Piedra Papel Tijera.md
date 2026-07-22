---
id: modryva-games-rps
title: Piedra Papel Tijera
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/catalog.ts
  - apps/api/src/games/games.service.ts
  - apps/web/components/games/rps-game.tsx
tags:
  - modryva
  - feature
  - games
aliases: [rps, "rock paper scissors"]
created: 2026-07-12
updated: 2026-07-12
---

# Piedra Papel Tijera

## Qué hace
Minijuego al mejor de 5 contra una CPU batible en el hub de juegos de la Mini App. Como el resto de arcade, la partida corre en el cliente y el servidor emite la sesión, valida el tiempo y acota la puntuación antes de sumarla al `GameScore` compartido.

## Evidencia
- `modules/games/src/catalog.ts:12` declara el `GameId` `"rps"`; spec en `catalog.ts:68-75`: `maxRawScore: 5`, `minDurationMs: 800`, `maxDurationMs: 600_000`. El comentario `catalog.ts:56-59` explica la puntuación bruta = **rondas ganadas (0..5, best of 5)**.
- Normalización: `scoreToPoints("rps", raw)` (`catalog.ts:108-114`) reparte 0..5 bruto sobre 0..3 puntos del leaderboard (redondeo por fracción).
- Sesión y envío único: `GamesService.start`/`submit` (`apps/api/src/games/games.service.ts:273-340`) con `isPlausibleScore` (`catalog.ts:89-106`).
- Tablero cliente: `apps/web/components/games/rps-game.tsx` (existe).
- Tests: `modules/games/src/catalog.test.ts`.
- Invocado en: `apps/api/src/games/games.controller.ts:42-67`.

## Estado / cableado
`implemented`: se abre desde el hub de juegos (`apps/bot/src/handlers/games-hub.ts`). Comparte el mismo leaderboard por scope (group / personal / portable) que los demás juegos.

## Preguntas abiertas
- La resolución de cada ronda (piedra>tijera, etc.) se hace en el cliente; el servidor solo acota `rawScore ≤ 5` y la ventana temporal. No hay resolver puro en `modules/games/src` para RPS (a diferencia de otros juegos).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]], [[Sesiones de Juego]], [[Catálogo Arcade y Anti-Cheat]]
- Relacionado con: [[Tres en Raya]], [[Nivel de Jugador]], [[Modelo GameScore]], [[Comando rps]], [[Comando jugar]]
