---
id: controller-games
title: Controller games
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/games/games.controller.ts, apps/api/src/games/games.service.ts]
tags: [modryva, controller, api]
aliases: [GamesController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller games

`GamesController` (`apps/api/src/games/games.controller.ts:37`). Fachada HTTP de los **juegos de la Mini App**: arcade con anti-cheat (sesión→puntuación), perfil de jugador, trivia diaria de grupo, trivia solo ilimitada (quiz) y jefe cooperativo. Prefijo `@Controller("v1/games")` con `@UseGuards(InitDataGuard)` (`:35`).

Delega en [[Servicio games]] (`@Inject(GamesService)`, `:40`). `playerProfileFromInitData` (`:18`) extrae nombre/username del usuario verificado del initData para mostrarlo en rankings.

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| POST | `start` | Abre una sesión de juego (`{ game }`) — devuelve `sessionId`. | InitDataGuard | `:42` |
| POST | `submit` | Envía puntuación (`{ sessionId, score }`); valida body. | InitDataGuard | `:54` |
| POST | `leaderboard` | Ranking del scope (grupo o global). | InitDataGuard | `:69` |
| POST | `profile` | Home del jugador: puntos, nivel, racha, rango, top. | InitDataGuard | `:78` |
| POST | `daily` | Trivia diaria del grupo (pregunta, participantes, board). | InitDataGuard | `:88` |
| POST | `daily/answer` | Responde la trivia diaria (`{ optionIndex }`). | InitDataGuard | `:97` |
| POST | `quiz` | Lote de trivia solo ilimitada (`{ round }`) del banco 5000+. | InitDataGuard | `:118` |
| POST | `boss` | Estado del jefe cooperativo del grupo. | InitDataGuard | `:125` |
| POST | `boss/attack` | Ataca al jefe (una vez al día). | InitDataGuard | `:134` |

`start`/`daily`/`boss` reciben `ctx.startParam` para resolver el grupo (scope) y `{ username, token }` del bot servidor. `submit` y `daily/answer` validan el body y lanzan 400 `invalid-body` si falta (`:60`, `:103`).

## Modelos que toca

[[Modelo GameSession]] (anti-cheat), [[Modelo GameScore]], [[Modelo DailyTrivia]], [[Modelo CoopBoss]], [[Modelo Reputation]] (via [[Servicio games]]).

## Consumido desde apps/web

`startGame` (`apps/web/lib/api.ts:443`), `submitScore` (`:449`), `gamesLeaderboard` (`:455`), `playerProfile` (`:479`), `dailyTrivia` (`:494`), `answerDailyTrivia` (`:497`), `quizBatch` (`:550`), `coopBoss` (`:537`), `attackBoss` (`:540`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio games]].
- **Utilizado por**: [[Pantalla games]] vía `apps/web/lib/api.ts`.
- **Consume**: [[Modelo GameSession]], [[Modelo DailyTrivia]], [[Modelo CoopBoss]].
- **Relacionado con**: [[Controller casino]], [[Controller gamification]], [[Controller config]] (games-config), [[API Map]].
