---
id: modryva-games-sessions
title: Sesiones de Juego
type: feature
domain: games
status: implemented
maturity: stable
source:
  - apps/api/src/games/games.service.ts
  - modules/games/src/catalog.ts
  - packages/data/src/game-repository.ts
tags:
  - modryva
  - feature
  - games
aliases: ["game sessions", "anti-cheat arcade"]
created: 2026-07-12
updated: 2026-07-12
---

# Sesiones de Juego

## Qué hace
Infraestructura server-authoritative de sesiones para los juegos arcade de la Mini App. El servidor emite la sesión (reloj del servidor), verifica propiedad y **un solo envío por sesión** (atómico), acota la puntuación por los topes de plausibilidad y — en sesiones ligadas a grupo — exige pertenencia viva al grupo para que nadie inyecte scores en un leaderboard del que no forma parte. Los scores caen en la MISMA tabla `GameScore` que trivia/quiz.

## Evidencia
- `GamesService.start(userId, startParam, game, player, bot)` (`apps/api/src/games/games.service.ts:273-300`): valida `isGameId` (L280), recuerda el nombre del jugador best-effort (L285), resuelve el scope (L286-291) y crea la sesión `arcade:<game>` vía `this.games.createSession(...)` (L292-298).
- `submit(userId, sessionId, rawScore, bot)` (`games.service.ts:302-340`): exige sesión `open` (L308-311) y propiedad (`payload.telegramUserId === userId`, L316-318); `elapsedMs = Date.now() - session.createdAt` (L324); rechaza si `!isPlausibleScore` (L325-327); **cierra atómicamente** con `closeWithWinner` para que un segundo submit falle (L330-333); convierte con `scoreToPoints` y persiste con `addScore` (L335-337).
- Resolución de scope (group/personal/portable) con verificación de membresía Telegram: `resolveScope` (`games.service.ts:225-271`) — un `groupId` inválido no revienta con 500, cae a personal (L238-245).
- Persistencia: `PrismaGameRepository` (`packages/data/src/game-repository.ts`) — `createSession`, `getSession`, `closeWithWinner`, `addScore`, `topScores`, `topPlayers`, `sumUserPoints`.
- Docstring del contrato anti-cheat: `games.service.ts:184-190`.
- Tests: `apps/api/src/games/games.service.test.ts`.
- Invocado en: `POST /v1/games/start`, `/submit`, `/leaderboard` (`apps/api/src/games/games.controller.ts:42-76`).

## Estado / cableado
`implemented`. Lo usan todos los arcade ([[Tres en Raya]], [[Piedra Papel Tijera]], [[Quiz Arcade Solo]], reflex, parejas, cálculo rápido). Los topes por juego vienen de [[Catálogo Arcade y Anti-Cheat]].

## Preguntas abiertas
- La plausibilidad es la "primera línea de defensa" (acota rango + ventana temporal), no hace inforjeable el score cliente (`catalog.ts:83-88`).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]], [[Catálogo Arcade y Anti-Cheat]]
- Produce: [[Modelo GameScore]], [[Modelo GameSession]]
- Relacionado con: [[Nivel de Jugador]], [[Racha de Juego]], [[Servicio casino]]
