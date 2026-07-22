---
id: fun
title: Fun
type: feature
domain: community
status: implemented
maturity: stable
source: [modules/community/src/fun.ts, apps/bot/src/bot-update.service.ts]
tags: [modryva, feature, community]
aliases: [juegos ligeros, 8ball, coin, roll, rps, love, rate, dice]
created: 2026-07-12
updated: 2026-07-12
---

# Fun

Comandos lúdicos ligeros (sin persistencia): bola 8, moneda, dados, piedra-papel-tijera, compatibilidad y rating. Lógica pura y determinista en `modules/community/src/fun.ts` (nunca usa reloj ni aleatoriedad real: todo deriva de un seed que inyecta el bot).

## Comandos

Parser `parseFunCommand` (`fun.ts:69-155`), handler `fun.command` (`apps/bot/src/bot-update.service.ts:1577`) + callback `fun.callback` (`bot-update.service.ts:1581`). Nombres y alias (`fun.ts:41-58`):

- `/8ball` (`/bola8`) — respuesta mágica de una lista fija (`eightBallAnswer`, `fun.ts:208-210`).
- `/coin` (`/flip`, `/moneda`) — cara/cruz (`coinFlip`, `fun.ts:216-217`).
- `/roll [NdM]` — tira dados, `1<=N<=20`, `2<=M<=1000` (`rollDice`, `fun.ts:224-240`).
- `/rps [piedra|papel|tijera]` — piedra-papel-tijera; sin argumento muestra teclado inline (`buildRpsKeyboard`, `fun.ts:293-301`; resolución `rpsOutcome`, `fun.ts:255-270`).
- `/love` (`/ship`) `n1 | n2` — compatibilidad 0..100, simétrica y determinista (`loveScore`, `fun.ts:308-315`).
- `/rate <algo>` — puntuación 0..10 (`rateScore`, `fun.ts:322-323`).
- Dados nativos de Telegram (`/dice`, `/dart`, `/basket`, `/soccer`, `/bowling`, `/slots`) → `sendDice` con el emoji de `NATIVE_DICE` (`fun.ts:32-39,148-152`).

## Determinismo

Los resultados derivan de hashes FNV-1a y un LCG de 32 bits (`fun.ts:161-176`), sembrados por el bot, de modo que cada resultado es reproducible.

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Utilizado por**: [[Comando rps]] (`/rps`), [[Comando roll]] (`/roll`)
- **Relacionado con**: [[Trivia Comunitaria]], [[Commands Map]]
