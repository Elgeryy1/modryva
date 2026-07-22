---
id: modryva-componente-casino-shared
title: Componente Casino shared
type: component
domain: web
status: implemented
maturity: stable
source:
  - apps/web/components/casino/shared.tsx
tags:
  - modryva
  - component
  - web
  - casino
aliases:
  - shared.tsx casino
created: 2026-07-12
updated: 2026-07-12
---

# Componente Casino shared (`shared.tsx`)

## Qué es
Módulo de componentes/utilidades **compartidos** por todos los juegos de la mesa de casino en la Mini App
(`apps/web/components/casino/shared.tsx`). Estandariza cómo se muestra el resultado de una apuesta y el
feedback háptico.

## Piezas clave
- **`GameResult`**: tipo del resultado de una ronda. Incluye `neutral?: boolean` e `icon?: string` (añadidos
  en la [[Casino Bug Audit 2026-07|auditoría de bugs]]) para representar **empate/aviso sin ±importe**.
- **`ResultCard`**: renderiza el resultado. Si `result.neutral`, muestra un aviso sin cantidad (clase
  `.result-notice` en `globals.css`) en vez de una ganancia/pérdida; el háptico usa `"warning"` en ese caso.
- Helpers de formato/estado reutilizados por [[Pantalla casino]] y cada juego (Mines, Crash, Blackjack,
  Dice, Plinko, Roulette, HiLo, SicBo, Baccarat, Keno).

## Por qué importa (lección)
Antes, victorias/empates podían pintarse como pérdida. El resultado **neutral** cierra esa clase de bug de
"clasificación de resultado" → ver [[Casino Bug Audit 2026-07]]. Los mensajes de error de apuesta se
traducen con `casinoErrorLabel` / `CASINO_ERROR_ES` (`apps/web/lib/api.ts`).

## Estado
Implementado y en producción (desplegado con la corrección de los 21 bugs del casino).

## Relaciones
- Pertenece a: [[Product Map]]
- Usado por: [[Pantalla casino]]
- Relacionado con: [[Casino Bug Audit 2026-07]], [[Casino Map]], [[Servicio casino]]
