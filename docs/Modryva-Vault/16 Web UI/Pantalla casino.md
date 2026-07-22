---
id: modryva-pantalla-casino
title: Pantalla casino
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/casino/page.tsx
  - apps/web/components/casino/shared.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Casino hub
  - Mesa de casino
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla casino

## Qué es
**Hub del casino** de fichas virtuales (provably-fair). Orquesta el shell (`Screen` + `AppHeader` con `ChipBadge` de saldo en vivo), mantiene el saldo/resultado/jackpot compartidos y alterna entre la rejilla de juegos y un juego seleccionado. Cada juego reporta su ronda liquidada por `onResult`, que muestra la `ResultCard` animada arriba (`page.tsx:3-6`).

Juegos jugables (cada uno con su API de apuesta, `page.tsx:65-146`): Crash, Minas, Plinko, Ruleta, Dado, Blackjack, Sic Bo, Baccarat, Keno, Hi-Lo. Vistas sociales (solo lectura): `Leaderboard` (Clasificación) y `Tournament` (Torneo semanal) (`page.tsx:53`, `204-216`).

Deep link: si `start_param` es `casino_<juego>` abre ese juego directamente (`page.tsx:171-178`). El botón atrás nativo vuelve al hub y refresca saldo (`page.tsx:180-183`, `useBackButton` en `ActiveGame`/`SocialPanel`).

## Ruta y componentes
- Ruta Next real: `/casino` (`apps/web/app/casino/page.tsx`), client component (`page.tsx:1`).
- Componentes de juego en `components/casino/*.tsx` (Baccarat, Blackjack, Crash, Dice, HiLo, Keno, Mines, Plinko, Roulette, SicBo) y sociales (`Leaderboard`, `Tournament`).
- Compartidos: `ChipBadge`, `JackpotBanner`, `ResultCard`, tipos `CasinoGameProps`/`GameResult` (`components/casino/shared.tsx`, `page.tsx:20-27`).
- Kit UI: `Screen`, `AppHeader`, `Group`, `GroupNote`, `Row`, `useBackButton` (`page.tsx:28-36`).

## Datos (API) — bajo `/v1/casino/*`
- `casinoBalance()` → `POST /v1/casino/balance` (`api.ts:771`).
- `getJackpot()` → `GET /v1/casino/jackpot` (`api.ts:800`).
- Apuestas: `POST /v1/casino/bet` y endpoints por juego (`crash/start`, `crash/cashout`, `mines/start`, `mines/reveal`, `mines/cashout`, `blackjack/start`, `blackjack/action`, …, `api.ts:791-911`).
- Social: `POST /v1/casino/leaderboard` (`api.ts:813`), `POST /v1/casino/tournament` (`api.ts:825`).
- Errores de casino traducidos a español en `api.ts:48-73` (`casinoErrorLabel`).
- Ver `[[Controller casino]]`, `[[Endpoint POST v1 casino bet]]`.

## Estado
Implementada y desplegada (según memoria del proyecto: las 4 fases del casino social + auditoría por juego). Saldo, jackpot y resultado se refrescan con cada retorno al hub (`page.tsx:154-165`).

## Preguntas abiertas
- El detalle provably-fair (revelación de semilla) se implementa en la API; la Mini App solo lo enuncia (`page.tsx:251-254`).

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Integración Telegram Mini Apps]], [[Guard InitData]]
- Relacionado con: [[Controller casino]], [[Pantalla games]], [[Pantalla Mini App]], [[API Overview]]
