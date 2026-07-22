---
id: modryva-support-customer-signals
title: Señales de Cliente Enfado y VIP
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/angry-customer.ts
  - modules/support/src/vip-client.ts
tags:
  - modryva
  - feature
  - support
aliases:
  - Cliente Enfadado
  - Trato VIP
created: 2026-07-12
updated: 2026-07-12
---

# Señales de Cliente Enfado y VIP

## Qué hace
Dos señales para priorizar la cola de soporte por cliente:
- Enfado (`detectAngerLevel(text)`): estima el nivel (`ninguno|leve|alto`)
  combinando términos de queja (horrible, pésimo, estafa, reembolso...), griterío
  en mayúsculas y puntuación repetida ("!!!"); devuelve nivel, puntuación y
  aciertos en orden fijo. `isHighFrustration` es el atajo booleano.
- VIP (`applyVipTreatment({ plan, baseMinutes })`): si el plan es `vip`, reduce a
  la mitad (redondeando) el SLA en minutos; los planes `free`/`pro` conservan su
  SLA saneado.

## Evidencia
- `modules/support/src/angry-customer.ts:109` `detectAngerLevel`;
  `angry-customer.ts:137` `isHighFrustration`.
- `modules/support/src/vip-client.ts:33` `applyVipTreatment`.
- Tests: `angry-customer.test.ts`, `vip-client.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:15002`
  (`detectAngerLevel(text)` → `/enfado`) y `bot-update.service.ts:16746`
  (`applyVipTreatment({...})` → `/trato_vip`), en `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuestos como comandos de utilidad `/enfado` y `/trato_vip`.
Lógica pura; no se verificó que la detección de enfado se aplique
automáticamente para reordenar la cola de tickets.

## Preguntas abiertas
- ¿Se usa `detectAngerLevel` de forma automática al recibir mensajes de soporte,
  o solo mediante el comando? → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Tickets de Soporte]], [[Seguimiento de SLA]], [[Escalado a Humano]]
