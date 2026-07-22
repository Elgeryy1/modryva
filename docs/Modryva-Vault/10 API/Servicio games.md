---
id: servicio-games
title: Servicio games
type: service
domain: api
status: implemented
maturity: stable
source: [apps/api/src/games/games.service.ts]
tags: [modryva, service, api]
aliases: [GamesService]
created: 2026-07-12
updated: 2026-07-12
---

# Servicio games

`GamesService` (`apps/api/src/games/games.service.ts:191`) implementa los **juegos sociales** de la Mini App con anti-cheat del lado del servidor. Los puntos de todos los modos caen en la misma tabla `GameScore`.

## Resolución de scope

`resolveScope(startParam, userId, tenantId, bot?)` (`:225`) decide dónde se atribuye el juego a partir del `start_param` firmado:
- `inlineGame` → `portable` (`inline:global`).
- `game_<name>_<gid>` o `games_<gid>` → `group` si el chat existe **y** el usuario es miembro vivo del grupo (verifica `getChatMember`); si no, cae a personal/portable.
- Hub sin grupo → `portable`; resto → `personal` (`dm:<tenantId>:<userId>`, namespaced por tenant para no mezclar puntos entre bot primario e hijos).

## Métodos (usados por [[Controller games]])

- **`start(userId, startParam, game, player?, bot?)`** (`:273`): valida `isGameId`, recuerda el nombre del jugador (best-effort), crea sesión `arcade:<game>` con reloj del servidor. Juego desconocido → `400 unknown-game`.
- **`submit(userId, sessionId, rawScore, bot?)`** (`:302`): verifica propiedad de la sesión (`not-your-session`), que esté abierta (`session-not-open`), plausibilidad del score (`implausible-score`), cierra la sesión de forma **atómica** (`already-submitted`) y suma puntos.
- **`leaderboard`** (`:342`), **`quizBatch`** (`:416`, trivia solo ilimitada del banco 5000+ con `correctIndex` incluido), **`dailyTrivia`** (`:458`) / **`answerDailyTrivia`** (`:513`, idempotente por día, cadencia diaria/horaria por `GamesConfig`), **`coopBoss`** (`:644`) / **`attackBoss`** (`:667`, un ataque por miembro y día, daño fijo, recompensa colectiva al derrotar), **`playerProfile`** (`:806`, home del jugador con racha, nivel y rank global).

## Anti-cheat y consistencia

- Sesión emitida por el servidor con su reloj; un submit por sesión (cierre atómico `closeWithWinner`).
- Score acotado por `isPlausibleScore` y convertido con `scoreToPoints` (catálogo de `@superbot/module-games`).
- Grupos: exige membresía viva para no inyectar scores en leaderboards ajenos.
- `markDailyPlay` (idempotente por día) alimenta la racha en el home.

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: `PrismaGameRepository`, `PrismaChatActivityRepository`, `PrismaChatSettingRepository`, `PrismaFoundationRepository` (`@superbot/data`); `@superbot/module-games` (lógica de juego); `HttpTelegramGateway` (`@superbot/telegram`); `@superbot/shared` (`decodeStartParam`, `parseGamesConfig`).
- **Utilizado por**: [[Controller games]].
- **Consume**: [[Modelo GameScore]], [[Modelo GameSession]], [[Modelo ChatActivityEvent]], [[Modelo ChatSetting]], [[Modelo AppUser]], [[Modelo Tenant]].
- **Relacionado con**: [[Servicio casino]], [[Pantalla juegos]].
