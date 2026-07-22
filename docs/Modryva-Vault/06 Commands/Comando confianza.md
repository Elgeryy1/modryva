---
id: modryva-command-confianza
title: Comando confianza
type: command
domain: community
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - modules/community/src/trust-tiers.ts
tags:
  - modryva
  - command
  - community
  - trust
aliases:
  - "/confianza"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /confianza

## Propósito
Muestra tu **nivel de confianza** en el grupo y los permisos que desbloquea (enviar enlaces, media, usar
modo inline). Es un sistema de reputación progresiva que combina varias señales.

## Sintaxis
`/confianza` (sin argumentos, dentro del grupo; calcula el del usuario que lo invoca).

## Permisos
Ninguno especial: cada usuario consulta el suyo. No requiere bot admin.

## Implementación
`handleTrustTierCommand` (`apps/bot/src/bot-update.service.ts:3756`; sale si `command.name !== "confianza"`).
Reúne en paralelo: antigüedad (`getMembershipJoinedAt`), mensajes (`analyticsRepository`), reputación,
avisos activos (`countActiveWarnings`) y gracias recibidas; luego `computeTrustTier(stats)` y `tierUnlocks`
(`modules/community/src/trust-tiers.ts`).

## Modelos que toca
Solo lectura, agregando: [[Modelo Membership]], [[Modelo UserActivity]], [[Modelo ReputationProfile]],
[[Modelo Warning]] y gratitud. No hay tabla propia de "trust tier": se calcula al vuelo.

## Eventos
Ninguno (solo lectura).

## Errores / edge-cases
"No pude identificarte" si falta `userId`/`membershipId`. Los unlocks son informativos; el enforcement real
de enlaces/media lo hacen locks/scheduled strict mode.

## Tests
`modules/community/src/trust-tiers.ts` (tests de `computeTrustTier`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Consume: [[Modelo ReputationProfile]], [[Modelo Warning]], [[Modelo Membership]]
- Relacionado con: [[Comando top]], [[Comando novatos]], [[Security Map]]
