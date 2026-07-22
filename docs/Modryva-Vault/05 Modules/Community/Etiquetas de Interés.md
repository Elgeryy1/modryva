---
id: modryva-community-etiquetas-interes
title: Etiquetas de Interés
type: feature
domain: community
status: implemented
maturity: experimental
source:
  - modules/community/src/interest-tags.ts
tags:
  - modryva
  - feature
  - community
aliases: [intereses, interest tags, emparejamiento, matchmaking]
created: 2026-07-12
updated: 2026-07-12
---

# Etiquetas de Interés

## Qué hace
Roles por intereses: los miembros eligen etiquetas (p. ej. `futbol`, `react`, `cine`) con `/intereses add|remove|list` y el bot los empareja con quienes comparten gustos, ordenados por número de etiquetas en común.

## Evidencia
- `normalizeInterestTag` (minúsculas, sin diacríticos, separadores → guion) (`modules/community/src/interest-tags.ts:21-28`).
- `parseInterestCommand` (add/remove/list) (`interest-tags.ts:56-87`).
- `matchByInterest(userTags, others)` cuenta etiquetas compartidas y ordena desc, conservando el orden ante empates (`interest-tags.ts:113-141`).
- Test: `modules/community/src/interest-tags.test.ts`.

## Estado / cableado
Implemented. Handler `parseInterestCommand` en `apps/bot/src/bot-update.service.ts:12600`; el emparejamiento usa `matchByInterest(mine, others).slice(0, 3)` para sugerir hasta 3 afines (`bot-update.service.ts:12643`). Imports en `bot-update.service.ts:220,239`.

## Preguntas abiertas
- Dónde se guardan las etiquetas por usuario/grupo (modelo/clave) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Rompehielos]], [[Comando intereses]]
