---
id: modryva-community-reputacion
title: Reputación
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/reputation.ts
tags:
  - modryva
  - feature
  - community
aliases: [rep, reputation, karma, nivel, rank]
created: 2026-07-12
updated: 2026-07-12
---

# Reputación

## Qué hace
Sistema de reputación/karma por grupo, distinto de [[Gratitude Points]]: un miembro da +1 de reputación a otro respondiendo con `/rep`, ve la suya con `/rep` o `/level`/`/rank`, y hay ranking con `/top`. Los puntos se convierten en un nivel mediante una curva pura.

## Evidencia
- `parseReputationCommand` reconoce `rep`/`top`/`level`/`rank` y distingue dar / ver-propia / top / nivel (`modules/community/src/reputation.ts:18-68`).
- Curva de nivel: `levelForXp(xp) = floor(sqrt(xp/10))` e inversa `xpForLevel` (`reputation.ts:74-81`).
- Test: `modules/community/src/reputation.test.ts`.

## Estado / cableado
Implemented. `handleReputationCommand` (`apps/bot/src/bot-update.service.ts:3710-3800`): `top` usa `reputationRepository.top`; ver-propia lee `getProfile`; dar reputación bloquea auto-voto y aplica un cooldown por par dador/objetivo de 3600 s vía `floodCounter` antes de `reputationRepository.addPoints` (`bot-update.service.ts:3763-3783`). Muestra nivel con `levelForXp` y división con `divisionForPoints` (de [[Módulo games]]). Import en `bot-update.service.ts:214,253`.

## Preguntas abiertas
- Cómo se acumula el `xp` frente a `points` (¿XP por actividad? ¿por reputación recibida?) no se ve en este fichero → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]], [[Modelo ReputationProfile]]
- Relacionado con: [[Gratitude Points]], [[Niveles de Confianza]], [[Comando rep]]
