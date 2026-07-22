---
id: modryva-community-salon-fama
title: Salón de la Fama
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/hall-of-fame.ts
tags:
  - modryva
  - feature
  - community
aliases: [salonfama, hall of fame, salon de la fama, aportes utiles]
created: 2026-07-12
updated: 2026-07-12
---

# Salón de la Fama

## Qué hace
Ranking por VALOR de las contribuciones (no por cantidad de mensajes): puntúa votos positivos y agradecimientos por encima de los mensajes. `/salonfama` muestra el top del grupo.

## Evidencia
- Pesos `HOF_UPVOTE_WEIGHT=5`, `HOF_THANKS_WEIGHT=3`, `HOF_MESSAGE_WEIGHT=1` (`modules/community/src/hall-of-fame.ts:9-15`).
- `contributionValue = upvotes*5 + thanks*3 + messages*1` (negativos → 0) (`hall-of-fame.ts:42-45`).
- `topContributions(contribs, topN)` ordena desc por valor, empates por `userId` asc (`hall-of-fame.ts:53-71`).
- Test: `modules/community/src/hall-of-fame.test.ts`.

## Estado / cableado
Implemented. `handleSalonFamaCommand` (nombre de comando `salonfama`, `apps/bot/src/bot-update.service.ts:3943`) compone las contribuciones desde los top posters + gracias recibidas ([[Gratitude Points]]) y llama `topContributions(contribs, 5)` (`bot-update.service.ts:3958-3980`). Nota: `upvotes` se pasa como 0 en el cableado actual (`bot-update.service.ts:3967`). Import en `bot-update.service.ts:311`.

## Preguntas abiertas
- Los `upvotes` no se alimentan hoy (siempre 0), así que el valor se rige por gracias + mensajes → ¿pendiente cablear una fuente de votos positivos?

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Gratitude Points]], [[Reputación]], [[Activity y Analytics]], [[Comando salonfama]]
