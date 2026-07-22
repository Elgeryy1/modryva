---
id: modryva-community-niveles-confianza
title: Niveles de Confianza
type: feature
domain: community
status: implemented
maturity: experimental
source:
  - modules/community/src/trust-tiers.ts
tags:
  - modryva
  - feature
  - community
aliases: [trust tiers, confianza, tiers, permisos por comportamiento]
created: 2026-07-12
updated: 2026-07-12
---

# Niveles de Confianza

## Qué hace
Permisos que se DESBLOQUEAN por comportamiento (no por pago): a más antigüedad, mensajes, reputación y gracias, más sube el tier (`nuevo` → `activo` → `veterano` → `helper`) y más permisos gana (enviar enlaces, media, modo inline). Los warnings activos degradan el tier. `/confianza` muestra tu tier y permisos.

## Evidencia
- `TRUST_TIERS` y umbrales `TIER_REQUIREMENTS` por tier (`modules/community/src/trust-tiers.ts:13,57-72`).
- `computeTrustTier(stats)` elige el tier base más alto que cumple TODOS los umbrales y luego lo degrada `floor(activeWarnings / 2)` escalones (`trust-tiers.ts:79-121`).
- `tierUnlocks` (permisos por tier) y `formatTrustTier` (etiqueta con emoji) (`trust-tiers.ts:123-154`).
- Test: `modules/community/src/trust-tiers.test.ts`.

## Estado / cableado
Implemented. `handleTrustTierCommand` responde a `/confianza` (`apps/bot/src/bot-update.service.ts:3803-3858`): compone `TrustStats` con antigüedad (membership), mensajes, reputación ([[Modelo ReputationProfile]]), warnings activos y gracias recibidas ([[Gratitude Points]]), y muestra `computeTrustTier` + `tierUnlocks`. Imports en `bot-update.service.ts:160,199,304,308`.

## Preguntas abiertas
- Si `tierUnlocks` se aplica realmente como gate de permisos (dejar pasar enlaces/media) en el flujo de moderación, o solo se muestra informativo en `/confianza` → no se halló su uso como gate → posible informativo por ahora.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]], [[Modelo ReputationProfile]]
- Relacionado con: [[Reputación]], [[Gratitude Points]], [[Comando confianza]]
