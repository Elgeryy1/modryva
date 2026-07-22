---
id: controller-casino
title: Controller casino
type: controller
domain: api
status: implemented
maturity: stable
source: [apps/api/src/casino/casino.controller.ts, apps/api/src/casino/casino.service.ts]
tags: [modryva, controller, api]
aliases: [CasinoController]
created: 2026-07-12
updated: 2026-07-12
---

# Controller casino

`CasinoController` (`apps/api/src/casino/casino.controller.ts:19`). Fachada HTTP del **casino social de fichas virtuales provably-fair**: apuestas instantáneas, jackpot progresivo, leaderboard, torneo semanal y los tres juegos con estado (crash, mines, blackjack). Prefijo `@Controller("v1/casino")` con `@UseGuards(InitDataGuard)` (`:17`).

Delega toda la lógica en [[Servicio casino]] (`@Inject(CasinoService)`, `:21`). El controller es fino: extrae `getMiniappContext(req).userId` y pasa el body tal cual.

## Endpoints

| Método | Ruta | Propósito | Auth | Línea |
|---|---|---|---|---|
| POST | `balance` | Saldo + commit/clientSeed/nonce del usuario. | InitDataGuard | `:23` |
| POST | `bet` | Apuesta instantánea (`{ game, stake, params }`). | InitDataGuard | `:28` |
| GET | `jackpot` | Bote progresivo actual del tenant. | InitDataGuard | `:43` |
| POST | `leaderboard` | Top por fichas netas (`{ range: week\|all }`). | InitDataGuard | `:48` |
| POST | `tournament` | Torneo semanal: bote, deadline, standings y tu rango. | InitDataGuard | `:54` |
| POST | `crash/start` | Inicia partida de crash (`{ stake }`). | InitDataGuard | `:59` |
| POST | `crash/cashout` | Retira en crash (`{ betId, cashoutAt }`). | InitDataGuard | `:67` |
| POST | `mines/start` | Inicia mines (`{ stake, mineCount }`). | InitDataGuard | `:79` |
| POST | `mines/reveal` | Descubre casilla (`{ betId, tile }`). | InitDataGuard | `:91` |
| POST | `mines/cashout` | Retira en mines (`{ betId }`). | InitDataGuard | `:103` |
| POST | `blackjack/start` | Reparte blackjack (`{ stake }`). | InitDataGuard | `:114` |
| POST | `blackjack/action` | Acción de blackjack (`{ betId, action }`). | InitDataGuard | `:125` |

El servicio deriva el tenant del bot servidor; sin tenant devuelve `no-tenant`. Los errores se lanzan como `{ error: "<code>" }` (`insufficient`, `invalid-stake`, `bet-closed`, `no-bet`, `wrong-game`, …) y la web los traduce en `CASINO_ERROR_ES` (`apps/web/lib/api.ts:48`).

## Modelos que toca

[[Modelo CasinoBet]], [[Modelo CasinoBalance]], [[Modelo CasinoJackpot]], [[Modelo CasinoTournament]] (via [[Servicio casino]]).

## Consumido desde apps/web

`casinoBalance` (`apps/web/lib/api.ts:770`), `casinoBet` (`:773`), `getJackpot` (`:799`), `casinoLeaderboard` (`:811`), `casinoTournament` (`:818`), `crashStart`/`crashCashout` (`:827`/`:832`), `minesStart`/`minesReveal`/`minesCashout` (`:844`/`:854`/`:870`), `blackjackStart`/`blackjackAction` (`:882`/`:899`).

## Relaciones

- **Pertenece a**: [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio casino]].
- **Utilizado por**: [[Pantalla casino]] vía `apps/web/lib/api.ts`.
- **Consume**: [[Modelo CasinoBet]], [[Modelo CasinoJackpot]].
- **Relacionado con**: [[Controller games]], [[Endpoint POST v1 casino bet]], [[API Map]].
