---
id: chip-economy
title: Chip Economy
type: feature
domain: casino
source: [packages/data/src/chip-repository.ts, modules/games/src/casino.ts, apps/bot/src/bot-update.service.ts]
status: implemented
maturity: stable
tags: [modryva, feature, casino]
aliases: [economia-fichas, ledger, monedero, ChipRepository]
created: 2026-07-12
updated: 2026-07-12
---

# Chip Economy

Economía de fichas virtuales respaldada por ledger, en `PrismaChipRepository` (`packages/data/src/chip-repository.ts:371-1483`). Toda mutación de saldo escribe una fila en `ChipLedger` dentro de una `$transaction`, así el saldo es siempre reconstruible.

## Guardrail legal: `CHIP_REASONS` (union cerrado)

`chip-repository.ts:9-22` — razones permitidas del ledger:
`welcome · daily · bet · win · purchase · refund · jackpot · bonus · rakeback · gift · tournament`.

Es un `as const` deliberadamente **cerrado**: no existe `cashout`/`withdraw`, así que las fichas **no pueden salir como valor**. TypeScript rechaza cualquier otra razón en compilación — invariante legal que mantiene esto como casino social (virtual, no gambling). El test de `chip-repository` rompe el build si aparece una razón prohibida (`docs/casino-roadmap.md:44`).

## Débito atómico condicional (anti-overdraw)

`placeBet` (`chip-repository.ts:461-590`) hace el débito con la guardia en el `WHERE`:

```
updateMany({ where: { balance: { gte: stake } }, data: { balance: { decrement: stake }, nonce: { increment: 1 } } })
```

`count === 0` ⇒ fondos insuficientes. Una apuesta concurrente **nunca puede sobregirar**. El mismo patrón `balance: { gte: stake }` protege `debit` (L432-459), `openDuel` (L706-729), `claimDuel` (L760-774), `startCasinoBet` (L905-913) y `transfer` (L1167-1179).

`placeBet` incrementa el nonce en el mismo update, lee el `serverSeed` secreto, invoca el `resolve` puro, y credita `payout = floor(stake*multiplier)` con razón `win`. Es el camino **instantáneo**; ver [[Casino Bet Lifecycle]].

## Vista pública del monedero

`WalletState` (`chip-repository.ts:103-109`) expone `balance`, `serverSeedHash` (commit), `clientSeed`, `nonce` — **nunca** el `serverSeed` secreto. `ensureWallet` crea el monedero + grant de bienvenida idempotente (L374-420).

## Economía de retención (comandos)

| Mecanismo | Método repo | Idempotencia | Comando |
|---|---|---|---|
| Bono diario | `claimDaily` L592-625 | unique `(user, "daily", día)` | `/bono` |
| Cashback semanal (10% de pérdidas netas) | `claimCashback` L1048-1080 (`netSince` L1031-1046) | unique por `weekKey`, razón `rakeback` | `/cashback` |
| Rescate anti-churn (+200 si estás a cero) | `claimRescue` L1082-1131 | unique por bucket de 6h, razón `bonus` | `/rescate` |
| Nivel/VIP (Bronce→Diamante por `sqrt(wagered/500)`) | `totalWagered` L1020-1029 + `walletLevel` (`casino.ts:138-153`) | — | `/nivel` |
| Regalo atómico entre jugadores | `transfer` L1150-1206, razón `gift` | `refId` | `/regalar` |
| Compra con Telegram Stars (solo entrante) | `creditPurchase` L1208-1242 | `chargeId` `@unique` | `/comprar` |

Packs de Stars: `CHIP_PACKS` (`casino.ts:95-102`) — `s` 5.000/50⭐, `m` 15.000/120⭐, `l` 50.000/350⭐. Ver [[Comando casino]].

## Capa social

- **Jackpot progresivo**: `placeBet` rasca `JACKPOT_RAKE 1%` de cada apuesta al bote (`chip-repository.ts:30-33, 540-575`); una tirada provably-fair (`jackpotRoll` L36-46, ~1/4000) paga el bote entero. Piso `JACKPOT_SEED 200`, mínimo premiable 500. `getJackpot` L1244-1247.
- **Leaderboard** por fichas netas (`NET_REASONS = bet+win`, L55): `leaderboard` L1275-1283.
- **Torneo semanal ISO**: `tournamentState` L1312-1380, settle perezoso al primer read tras cerrar la ventana (`settleTournament` L1407-1481), split top-3 `[0.6,0.3,0.1]` (L57), pool inicial `1000` (L56). Ver [[Modelo CasinoDuel]] vecinos en [[Database Map]].

## Relaciones

- Pertenece a: [[Módulo games]]
- Depende de: [[Provably Fair]] (seeds, jackpotRoll), [[Modelo ChipWallet]], [[Modelo ChipLedger]]
- Utilizado por: [[Servicio casino]], `apps/bot/src/bot-update.service.ts`
- Produce: [[Modelo CasinoBet]], [[Modelo CasinoDuel]], filas de `ChipLedger`, `Jackpot`, `Tournament`
- Relacionado con: [[Casino Bet Lifecycle]], [[Comando casino]], [[Database Map]]
