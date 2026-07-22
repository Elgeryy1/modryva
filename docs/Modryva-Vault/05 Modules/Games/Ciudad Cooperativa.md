---
id: modryva-games-coop-city
title: Ciudad Cooperativa
type: feature
domain: games
status: partial
maturity: experimental
source:
  - modules/games/src/coop-city.ts
tags:
  - modryva
  - feature
  - games
aliases: ["coop city", "ciudad del grupo"]
created: 2026-07-12
updated: 2026-07-12
---

# Ciudad Cooperativa

## Qué hace
Lógica pura de una "ciudad" que el grupo construye entre todos donando recursos: agrega el total, calcula el porcentaje hacia una meta compartida y detecta al mayor donante.

## Evidencia
- `computeCoopCityProgress(contributions, goal)` (`modules/games/src/coop-city.ts:44-74`): `total` = suma de recursos; `percent` = `total/goal*100` redondeado y clampeado 0..100 (0 si `goal<=0`); `complete` solo si `goal>0 && total>=goal`; `topContributor` = mayor donante, empates al `userId` más bajo (L54-62).
- Formas de datos: `CoopCityContribution{userId, resources}` (`coop-city.ts:6-9`), `CoopCityProgress` (`coop-city.ts:18-23`).
- Tests: `modules/games/src/coop-city.test.ts`.

## Estado / cableado
`partial`: **lógica pura sin cablear**. `computeCoopCityProgress` no se importa fuera de `modules/games/src`. Contrasta con el [[Jefe Cooperativo]], que SÍ está orquestado en `games.service.ts`: comparte el patrón cooperativo pero esta ciudad no tiene servicio ni UI.

## Preguntas abiertas
- ¿Qué cuenta como "recurso" (mensajes, puntos, fichas) y de dónde saldría la meta? No verificable sin consumidor.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Jefe Cooperativo]], [[Reto Colectivo]], [[Recompensas Colectivas]]
