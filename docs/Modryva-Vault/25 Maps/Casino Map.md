---
id: moc-casino
title: Casino Map
type: moc
domain: casino
status: implemented
maturity: stable
tags:
  - modryva
  - moc
  - casino
  - games
created: 2026-07-12
updated: 2026-07-12
---

# Casino Map

Casino social de **fichas virtuales no canjeables** (línea legal: sin cash-out), provably-fair estilo Stake.
Lógica pura en `modules/games`, API en `apps/api/src/casino`, frontend en `apps/web/components/casino`.
Hub: [[Módulo games]]. Roadmap: `docs/casino-roadmap.md`.

## Fundamentos

- [[Provably Fair]] — commit + HMAC stream verificable.
- [[Chip Economy]] — [[Modelo ChipWallet]] / [[Modelo ChipLedger]], débito atómico, guardrail legal (CHIP_REASONS cerrado).
- [[Casino Bet Lifecycle]] — instant vs multi-paso ([[Modelo CasinoBet]]).
- [[Servicio casino]] · [[Controller casino]].

## Juegos de mesa (Mini App)

[[Juego Crash]] · [[Juego Mines]] · [[Juego Plinko]] · [[Juego Ruleta]] · [[Juego Blackjack]] ·
[[Juego Keno]] · [[Juego SicBo]] · [[Juego Baccarat]] · [[Juego HiLo]] · [[Juego Dice]]

## Juegos nativos (en chat)

[[Juego Slotstorm]] · [[Juego Over-Under]] · [[Juego Bullseye]] · [[Juego Dice Duel]]

## Economía y social

Bono diario, cashback/rakeback, rescate, nivel-VIP, regalar, comprar (Telegram Stars). Ver [[Chip Economy]].

## Calidad

- [[Casino Bug Audit 2026-07]] — auditoría 1-agente-por-juego: 21 bugs arreglados y desplegados.

## Comandos

[[Comando casino]] · [[Comando cartera]] · [[Comando bono]] · [[Comando dado]] · [[Comando apostar]] ·
[[Comando duelo]] · [[Comando comprar]] · [[Comando regalar]]

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Modules Map]], [[Database Map]], [[API Map]], [[Product Map]]
