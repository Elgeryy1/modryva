---
id: modryva-command-cartera
title: Comando cartera
type: command
domain: casino
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - modules/games/src/casino.ts
tags:
  - modryva
  - command
  - casino
aliases:
  - "/cartera"
  - "/wallet"
  - "/saldo"
  - "/fichas"
  - "/verificar"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /cartera

## Propósito
Muestra tu saldo de fichas virtuales del casino y el commit provably-fair (hash del server seed + nonce).
`/verificar` muestra los datos completos de juego justo (commit, client seed, nonce y fórmula HMAC).

## Comandos cubiertos
| Comando | `kind` | Salida |
|---|---|---|
| `/cartera` `/wallet` `/saldo` `/fichas` | wallet | Saldo + commit (`bot-update.service.ts:2483`). |
| `/verificar` `/verify` | verify | Datos provably-fair completos (2490). |

Aliases nativos en `modules/games/src/casino.ts:113-116` (wallet) y `:120` (verify).

## Sintaxis
`/cartera` (o `/wallet`/`/saldo`/`/fichas`) · `/verificar`.

## Permisos
Ninguno especial (por usuario). No requiere bot admin. La economía es por (tenant, usuario).

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`) vía `parseCasinoCommand`, registrado como
`casino.command` (línea 1509). Usa `chipRepository.ensureWallet(...)` (crea con `CASINO.welcomeGrant` si no
existe).

## Modelos que toca
[[Modelo ChipWallet]] (saldo, serverSeedHash, clientSeed, nonce).

## Eventos
Ninguno (solo consulta; `ensureWallet` puede crear la cartera inicial).

## Errores / edge-cases
Sin `userId` el handler devuelve `null`. El commit se muestra truncado en `/cartera` y completo en `/verificar`.

## Tests
`modules/games/src/casino.ts` (tests del parser/fairness) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]]
- Consume: [[Modelo ChipWallet]]
- Relacionado con: [[Comando casino]], [[Comando bono]], [[Chip Economy]], [[Casino Map]]
