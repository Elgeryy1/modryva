---
id: modryva-community-rompehielos
title: Rompehielos
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/icebreakers.ts
tags:
  - modryva
  - feature
  - community
aliases: [icebreakers, rompehielo, dinamica]
created: 2026-07-12
updated: 2026-07-12
---

# Rompehielos

## Qué hace
Banco de preguntas para animar la conversación, agrupadas por tema (`general`, `gaming`, `tech`, `musica`, `estudio`). `/rompehielo <tema>` devuelve una pregunta elegida de forma determinista (hash FNV-1a de una semilla, nunca `Math.random`).

## Evidencia
- `ICEBREAKER_BANK` con 5 preguntas por tema (`modules/community/src/icebreakers.ts:20-58`).
- `listIcebreakerTopics`, `isIcebreakerTopic` (type guard) y `pickIcebreaker(topic, seed)` con fallback a `general` (`icebreakers.ts:72-112`).
- Test: `modules/community/src/icebreakers.test.ts`.

## Estado / cableado
Implemented. Caso `rompehielo` del dispatcher de comunidad: valida el tema con `isIcebreakerTopic`, lista temas con `listIcebreakerTopics` y elige con `pickIcebreaker(topic, update.updateId)` (`apps/bot/src/bot-update.service.ts:16771-16784`). Imports en `bot-update.service.ts:207,215,266`.

## Preguntas abiertas
- Si existe además disparo automático/periódico de rompehielos (p. ej. junto a [[Rituales]]) o solo bajo demanda → no se halló disparo automático; parece solo `/rompehielo`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Rituales]], [[Etiquetas de Interés]], [[Comando rompehielo]]
