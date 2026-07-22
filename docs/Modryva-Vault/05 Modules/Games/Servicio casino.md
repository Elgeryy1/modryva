---
id: servicio-casino
title: Servicio casino
type: service
domain: casino
source: [apps/api/src/casino/casino.service.ts, apps/api/src/casino/casino.controller.ts]
status: implemented
maturity: beta
tags: [modryva, service, casino]
aliases: [CasinoService, casino.service]
created: 2026-07-12
updated: 2026-07-12
---

# Servicio casino

`CasinoService` (`apps/api/src/casino/casino.service.ts:51`), servicio NestJS server-authoritative que sirve el casino de la Mini App. Expuesto por [[Controller casino]] bajo `/v1/casino/*`, protegido por `InitDataGuard` (initData de Telegram firmado por HMAC).

## Responsabilidades

- **Tenant scoping**: `tenantId()` resuelve el tenant desde `TELEGRAM_BOT_USERNAME` (`telegram-<botkey>`); 503 `no-tenant` si no existe (L56-67).
- **Validación de stake**: `validStake` exige entero en `[CASINO.minBet, CASINO.maxBet]` = `[10, 10_000]` (L69-79).
- **Monedero**: `balance()` asegura el monedero (grant de bienvenida) y devuelve `balance` + `commit`/`clientSeed`/`nonce` (L81-94).

## Juegos instantáneos: `instantResolver`

`instantBet` (L98-141) valida el stake, asegura el monedero y delega a `chips.placeBet` con un resolver construido por `instantResolver` (L216-301). Cada rama valida `params`, lanza `BadRequestException` en entradas inválidas, y envuelve el resultado del módulo puro en `{ multiplier, detail }`:

| game | validación (params) | módulo puro |
|---|---|---|
| `dice` | side bajo/alto, target 1..99 | `resolveDice` |
| `plinko` | risk bajo/medio/alto, rows 8/12/16 | `resolvePlinko` |
| `roulette` | `parseRouletteBet` (straight/red…/dozen/column) L318-338 | `spinRoulette`+`rouletteMultiplier` |
| `sicbo` | `parseSicBoBet` (small/big/triple 1..6) L303-316 | `rollSicBo`+`sicBoMultiplier` |
| `baccarat` | kind player/banker/tie | `dealBaccarat`+`baccaratMultiplier` |
| `keno` | 3 picks únicos 1..20 | `drawKeno`+`kenoMultiplier` |
| `hilo` | kind higher/lower | `dealHiLo`+`hiLoMultiplier` |

Nota: el `detail` que se devuelve va **anidado** por juego (`{ pocket, bet }`, `{ roll, bet }`, `{ deal, bet }`, `{ picks, drawn }`) — el front debe desanidar. Fue foco de bugs (ver [[Casino Bug Audit 2026-07]]).

## Juegos multi-paso

Cada uno genera `newServerSeed`, comita (`commit`), abre un `CasinoBet` con `clientSeed = "${userId}"` y `nonce = 0`, y liquida revelando el `serverSeed`:

- **Crash** — `crashStart` L352-384 (fija `crash` en el `state`), `crashCashout` L386-412 (`settleCrash`).
- **Mines** — `minesStart` L415-442 (guarda `layout`), `minesReveal` L474-545 (mina→settle 0; tablero limpio→auto-cashout L511-534), `minesCashout` L547-577.
- **Blackjack** — `blackjackStart` L580-614 (blackjack natural liquida directo), `blackjackAction` L616-665 (hit/stand; bust→settle), `blackjackSettle` L667-716 (siembra al crupier con sus 2 cartas — fix "house-breaking" L680-683).

Helper común `openBetWithSeed` (L444-472) propaga el saldo post-débito para que el header del Mini App se actualice al instante.

## Capa social

`jackpot()` L145-149, `leaderboard(range)` L151-163 y `tournament(userId)` L165-182 delegan al repositorio; `resolveNames` (L188-214) resuelve `displayName`/`@username` en batch desde `AppUser` para mostrar **nombres, no IDs**.

## Relaciones

- Pertenece a: [[Módulo games]]
- Depende de: [[Chip Economy]] (`PrismaChipRepository`), [[Provably Fair]] (`commit`, `newServerSeed`), módulos puros de cada [[Juego Crash]]/[[Juego Mines]]/…
- Utilizado por: [[Controller casino]], [[Componente Casino shared]] (vía `apps/web/lib/api.ts`)
- Produce: [[Modelo CasinoBet]], respuestas con `proof`/`reveal`
- Relacionado con: [[Casino Bet Lifecycle]], [[Casino Map]]
