---
id: modryva-command-nivel
title: Comando nivel
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
  - "/nivel"
  - "/vip"
  - "/cashback"
  - "/rakeback"
  - "/rescate"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /nivel

## Propósito
Extras de economía del casino: progreso de nivel/VIP por volumen apostado, cashback semanal por pérdidas y
rescate cuando te quedas a cero fichas.

## Comandos cubiertos
| Comando | `kind` | Efecto |
|---|---|---|
| `/nivel` `/vip` `/level` | level | Nivel + tier por `totalWagered` (`walletLevel`), fichas hasta el siguiente. |
| `/cashback` `/rakeback` | cashback | 10% de las pérdidas netas de la semana (`netSince`, `claimCashback`). |
| `/rescate` | rescate | Ayuda si te quedas a 0 fichas (solo cuando el saldo es cero). |

Aliases nativos en `modules/games/src/casino.ts:126` (level), `:127` (cashback), `:129` (rescate).

## Sintaxis
`/nivel` · `/cashback` · `/rescate` (sin argumentos).

## Permisos
Ninguno especial (por usuario). No requiere bot admin.

## Implementación
`handleCasinoCommand` (`apps/bot/src/bot-update.service.ts:2431`): `level` (2520), `cashback` (2532),
`rescate` (~2570). Usan `chipRepository` (`totalWagered`, `netSince`, `claimCashback`).

## Modelos que toca
[[Modelo ChipWallet]] + ledger (para wagered/net/cashback).

## Eventos
Ledger de fichas (cashback/rescate acreditan).

## Errores / edge-cases
Cashback: "No tienes pérdidas netas esta semana" o "Aún no acumulas cashback suficiente". Rescate: solo si
el saldo es cero ("Aún tienes fichas...").

## Tests
`modules/games/src/casino.ts` (`walletLevel`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Servicio casino]]
- Produce: [[Modelo ChipWallet]]
- Relacionado con: [[Comando cartera]], [[Comando bono]], [[Chip Economy]], [[Casino Map]]
