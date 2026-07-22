---
id: provably-fair
title: Provably Fair
type: feature
domain: casino
source: [modules/games/src/fairness.ts, packages/data/src/chip-repository.ts, apps/api/src/casino/casino.service.ts]
status: implemented
maturity: stable
tags: [modryva, feature, casino]
aliases: [fairness, commit-reveal, semilla]
created: 2026-07-12
updated: 2026-07-12
---

# Provably Fair

Núcleo commit-reveal del casino (`modules/games/src/fairness.ts`). Es **puro y determinista**: dados los seeds, cualquiera puede reverificar cada resultado, con el mismo esquema byte-stream → float que usa Stake (`fairness.ts:1-11`).

## Flujo commit-reveal

1. El servidor genera un `serverSeed` aleatorio de 32 bytes y publica `commit = sha256(serverSeed)` **antes** de cualquier apuesta (así no puede elegir la semilla tras ver la apuesta). `newServerSeed` `fairness.ts:16`; `commit` `fairness.ts:19-20`.
2. El cliente aporta (o se le asigna) un `clientSeed`; un `nonce` se incrementa por apuesta.
3. Cada resultado se deriva de `HMAC-SHA256(serverSeed, "${clientSeed}:${nonce}:${cursor}")`. `streamBytes` `fairness.ts:26-34`.
4. Al rotar la semilla se **revela** el `serverSeed`; cualquiera recomputa el commit y todos los resultados. `rotateSeed` en [[Chip Economy]] (`chip-repository.ts:653-685`).

`verifyCommit` comprueba que el `serverSeed` revelado coincide con el commit (`fairness.ts:23-24`).

## Primitivas derivadas

| Función | Qué devuelve | Uso |
|---|---|---|
| `fairFloat(ss,cs,nonce,cursor=0)` `fairness.ts:40-53` | float uniforme en `[0,1)` de los primeros 4 bytes del stream (fracción base-256, **sin módulo**) | dado, crash, plinko, sicbo, baccarat, hilo |
| `fairInt(ss,cs,nonce,min,max)` `fairness.ts:56-68` | entero uniforme en `[min,max]` inclusive | ruleta (0..36), baccarat |
| `fairShuffle(ss,cs,nonce,n)` `fairness.ts:75-90` | permutación Fisher-Yates verificable de `[0,n)`, un cursor distinto por swap | shoe de blackjack, layout de minas, sorteo de keno |

El **cursor** permite varias extracciones independientes con el MISMO nonce: plinko usa `cursor=row` (una por fila), sicbo `cursor=0/1/2` (un dado cada uno), baccarat/hilo `cursor=0/1` (dos cartas).

## Superficies de verificación

- Bot: `/verificar` muestra commit, clientSeed y nonce actual, y explica la fórmula (`apps/bot/src/bot-update.service.ts:2490-2502`).
- API: cada apuesta instantánea devuelve `proof: { commit, clientSeed, nonce }` (`casino.service.ts:135-139`).
- Bets multi-paso: el `serverSeed` se **revela** (`reveal`) al liquidar (`casino.service.ts:410`, `506`, `576`, `714`).

## Nota sobre juegos nativos

Slotstorm/Over-Under/Bullseye/Duelo NO usan `fairness.ts`: la aleatoriedad la genera `sendDice` de Telegram (provably-fair por construcción). Ver [[Juego Slotstorm]] y [[Comando casino]].

## Relaciones

- Pertenece a: [[Módulo games]]
- Utilizado por: todos los juegos de mesa ([[Juego Crash]], [[Juego Mines]], [[Juego Ruleta]]…), [[Servicio casino]], [[Chip Economy]] (`placeBet`, `rotateSeed`, jackpot)
- Produce: multiplicadores y `detail` reproducibles
- Relacionado con: [[Casino Map]], [[Modelo ChipWallet]] (guarda serverSeed/commit/clientSeed/nonce)
