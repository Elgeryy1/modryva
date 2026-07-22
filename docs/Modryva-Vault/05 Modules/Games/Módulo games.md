---
id: modulo-games
title: Módulo games
type: module
domain: games
status: implemented
maturity: beta
source: [modules/games/src/index.ts, modules/games/src/casino.ts, modules/games/src/fairness.ts, packages/data/src/chip-repository.ts, apps/api/src/casino/casino.service.ts, apps/web/app/casino/page.tsx]
tags: [modryva, module, casino]
aliases: [module-games, "@superbot/module-games"]
created: 2026-07-12
updated: 2026-07-12
---

# Módulo games

HUB del paquete `@superbot/module-games` (`modules/games/src/`). Agrupa **dos familias** de código muy distintas que comparten paquete:

1. **Casino social** (este dominio): lógica pura provably-fair de juegos de apuestas con **fichas virtuales no canjeables**. Es el foco de este Vault.
2. **Juegos comunitarios / gamificación** (trivia diaria, jefe cooperativo, quiz, ligas, logros, anti-fraude…): decenas de módulos exportados por `index.ts` que NO forman parte del casino y viven bajo el dominio de comunidad. Ver `source: modules/games/src/index.ts:1-71`.

Este HUB documenta la **arquitectura del casino**.

## Qué es y qué NO es (guardrail legal)

Casino **social**: las fichas son virtuales, **nunca salen como valor**. El invariante que lo garantiza es un union cerrado `CHIP_REASONS` sin `cashout`/`withdraw` (`packages/data/src/chip-repository.ts:9-22`). Copy obligado: "fichas virtuales, solo diversión", nunca "dinero"/"ganancias" (`apps/web/app/casino/page.tsx:251-254`). Ver [[Chip Economy]].

## Arquitectura en 4 capas

```
Front (Mini App)        API (NestJS)              Lógica pura            Persistencia
apps/web/components  →  apps/api/src/casino   →  modules/games/src  →  chip-repository
/casino/*.tsx           casino.service.ts        {crash,mines,...}.ts   (Prisma)
                        casino.controller.ts     fairness.ts            ChipWallet/Ledger
```

- **Lógica pura** (`modules/games/src/*.ts`): funciones deterministas sin I/O, reloj ni `Math.random`. Reciben `(serverSeed, clientSeed, nonce)` y devuelven `{ multiplier, detail }`. Verificables byte-a-byte. Ver [[Provably Fair]].
- **API server-authoritative** (`apps/api/src/casino/casino.service.ts`): traduce peticiones del Mini App a resolvers puros y llama al repositorio. Ver [[Servicio casino]] y [[Controller casino]].
- **chip-repository** (`packages/data/src/chip-repository.ts`): monedero + ledger atómico, débito condicional, seeds, duelos, bets multi-paso, jackpot, torneos. Ver [[Chip Economy]].
- **Front** (`apps/web/app/casino/page.tsx` + `components/casino/*.tsx`): hub de juegos, controles de apuesta compartidos, tarjeta de resultado animada. Ver [[Componente Casino shared]].

## Dos superficies de juego

| Superficie | Dónde | Juegos | Flujo |
|---|---|---|---|
| **Mesa (Mini App)** | web `/casino`, API `/v1/casino/*` | Crash, Mines, Plinko, Ruleta, Dado, Blackjack, SicBo, Baccarat, Keno, HiLo | instantáneo (`placeBet`) o multi-paso (`start`→`reveal`→`settle`) |
| **Nativo en chat** | `apps/bot/src/bot-update.service.ts` | Slotstorm 🎰, Over/Under 🎲🎲, Bullseye 🎯, Duelo PvP | débito → `sendDice` real de Telegram → precio → crédito |

Los juegos nativos delegan la aleatoriedad a `sendDice` de Telegram (provably-fair por construcción; el bot no puede trucar la tirada). Ver [[Comando casino]].

## Constantes de casa (`casino.ts:7-14`)

`welcomeGrant 1000` · `dailyBonus 500` · `houseEdge 0.02` · `minBet 10` · `maxBet 10_000` · `duelRake 0.05`. Fase 3 preveía moverlas a env (`RuntimeEnv`); aún son constantes horneadas (ver `docs/casino-roadmap.md`).

## Relaciones

- Pertenece a: [[Modules Map]]
- Depende de: [[Provably Fair]], [[Chip Economy]]
- Utilizado por: [[Servicio casino]] (API), `apps/bot/src/bot-update.service.ts` (bot), [[Componente Casino shared]] (web)
- Produce: multiplicadores de pago deterministas por juego
- Relacionado con: [[Casino Map]], [[Casino Bet Lifecycle]], [[Database Map]]
