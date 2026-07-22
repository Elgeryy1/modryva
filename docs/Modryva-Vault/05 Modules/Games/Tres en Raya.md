---
id: modryva-games-tictactoe
title: Tres en Raya
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/catalog.ts
  - apps/api/src/games/games.service.ts
  - apps/web/components/games/tic-tac-toe.tsx
tags:
  - modryva
  - feature
  - games
aliases: [tictactoe, "tic tac toe"]
created: 2026-07-12
updated: 2026-07-12
---

# Tres en Raya

## Qué hace
Minijuego por turnos contra una CPU **batible** dentro del hub de juegos de la Mini App. El tablero se juega en el cliente; el servidor solo emite la sesión, valida el tiempo y acota la puntuación. El resultado de la ronda se normaliza a puntos para el leaderboard compartido (`GameScore`), el mismo que trivia y quiz.

## Evidencia
- Catálogo y anti-cheat: `modules/games/src/catalog.ts:11` declara el `GameId` `"tictactoe"`; el spec en `catalog.ts:60-67` fija `maxRawScore: 3`, `minDurationMs: 800`, `maxDurationMs: 600_000`. El comentario `catalog.ts:56-59` documenta la puntuación bruta: **victoria 3 / empate 1 / derrota 0**.
- Normalización: `scoreToPoints("tictactoe", raw)` (`catalog.ts:108-114`) mapea 0..3 bruto → 0..3 puntos del leaderboard.
- Ciclo de sesión: `GamesService.start` (`apps/api/src/games/games.service.ts:273-300`) crea una sesión `arcade:tictactoe`; `submit` (`games.service.ts:302-340`) exige `isPlausibleScore` (`catalog.ts:89-106`) y cierra la sesión de forma atómica (un solo envío).
- Tablero cliente: `apps/web/components/games/tic-tac-toe.tsx` (existe; lógica de UI no auditada aquí).
- Tests: `modules/games/src/catalog.test.ts`.
- Invocado en: endpoints `POST /v1/games/start` y `/submit` (`apps/api/src/games/games.controller.ts:42-67`).

## Estado / cableado
`implemented`: jugable vía el hub de juegos (`/jugar`, `/games`, `/juegos` → botón Mini App, `apps/bot/src/handlers/games-hub.ts:16-19`). El score cuenta para el grupo cuando se abre con deep link `games_<gid>` (scope resuelto en `games.service.ts:225-271`).

## Preguntas abiertas
- La IA de la CPU y la validación de jugadas viven en el cliente (`tic-tac-toe.tsx`); el servidor confía en el `rawScore` acotado por `maxRawScore` y ventana temporal, no reconstruye la partida. Superficie de trampa client-side no cerrada (documentado como "primera línea de defensa" en `catalog.ts:83-88`).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]], [[Sesiones de Juego]], [[Catálogo Arcade y Anti-Cheat]]
- Relacionado con: [[Piedra Papel Tijera]], [[Nivel de Jugador]], [[Modelo GameScore]], [[Modelo GameSession]], [[Comando jugar]]
