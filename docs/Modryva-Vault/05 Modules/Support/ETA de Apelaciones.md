---
id: modryva-support-appeal-eta
title: ETA de Apelaciones
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/appeal-eta.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# ETA de Apelaciones

## Qué hace
Estima el tiempo de revisión (ETA) de una apelación pendiente a partir de cuántas
hay en cola delante y del tiempo medio de revisión por apelación.
`estimateAppealEta({ queueLength, avgReviewMs })` calcula `etaMs = cola *
avgReviewMs` (la cola se trunca a entero; negativos y no finitos se tratan como
0) y devuelve además una etiqueta humanizada en español (`humanizeEtaEs`), p. ej.
"en alrededor de 3 minutos" o "de inmediato". Puro, sin reloj.

## Evidencia
- `modules/support/src/appeal-eta.ts:88` `estimateAppealEta`; `appeal-eta.ts:58`
  `humanizeEtaEs`.
- Test: `modules/support/src/appeal-eta.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:534` (import) y
  `bot-update.service.ts:15062` (`estimateAppealEta({ queueLength, avgReviewMs })`),
  servido por el comando `/eta_apelacion` dentro de `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuesto como comando `/eta_apelacion`. Cálculo puro; la cola y el
tiempo medio los aporta el handler.

## Preguntas abiertas
- No verificado si el ETA se muestra automáticamente al apelante al crear la
  apelación → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Apelaciones por Privado]], [[Modelo Appeal]]
