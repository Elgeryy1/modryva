---
id: modryva-games-collective-rewards
title: Recompensas Colectivas
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/collective-rewards.ts
  - apps/api/src/games/games.service.ts
tags:
  - modryva
  - feature
  - games
aliases: ["collective rewards", computeCollectiveReward]
created: 2026-07-12
updated: 2026-07-12
---

# Recompensas Colectivas

## Qué hace
Evalúa una recompensa compartida por todo el grupo: cuando la mejora del grupo alcanza un umbral, cada miembro recibe la misma recompensa (en vez de premiar a individuos), con un mensaje en español listo para mostrar.

## Evidencia
- `computeCollectiveReward(input, options)` (`modules/games/src/collective-rewards.ts:57-74`): `earned = improvement >= threshold` (frontera inclusiva); `rewardPerMember` = recompensa si se gana, 0 si no; `message` en español (L69-71). `improvement` no finito se trata como 0 (L63-65).
- Tunables con fallback: `threshold` (default 10) y `reward` (default 50) vía `resolveTunable` (`collective-rewards.ts:40-48`), que ignora valores no finitos o negativos.
- Consumo real: el [[Jefe Cooperativo]] lo llama al derrotar al jefe — `GamesService.attackBoss` (`apps/api/src/games/games.service.ts:731-736`) invoca `computeCollectiveReward({improvement: state.goal}, {threshold: 1, reward: bossRewardFor(state.level)})` y usa `rewardPerMember`/`message`.
- Tests: `modules/games/src/collective-rewards.test.ts`.

## Estado / cableado
`implemented` (usado en el flujo del jefe cooperativo). Es lógica pura; el reparto real de fichas a cada miembro no lo hace este módulo — solo calcula el importe y el anuncio. No confundir con [[Reto Colectivo]] (`scoreCollectiveChallenge`), que sí está sin cablear.

## Preguntas abiertas
- ¿Se acreditan de verdad las fichas a cada miembro tras un anuncio de recompensa colectiva, o el `message` es solo cosmético? El acreditado no aparece en `attackBoss` (solo se anuncia); pendiente de verificar en `chip-repository`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Jefe Cooperativo]], [[Reto Colectivo]], [[Ciudad Cooperativa]], [[Chip Economy]]
