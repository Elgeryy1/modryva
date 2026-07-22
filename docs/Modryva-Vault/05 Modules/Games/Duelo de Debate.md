---
id: modryva-games-debate-duel
title: Duelo de Debate
type: feature
domain: games
status: implemented
maturity: experimental
source:
  - modules/games/src/debate-duel.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - games
aliases: [duelo_debate, "debate duel"]
created: 2026-07-12
updated: 2026-07-12
---

# Duelo de Debate

## Qué hace
Resuelve un debate controlado entre dos bandos (A y B) por conteo de votos, con **descalificación por insultos** que pesa por encima de los votos: un bando que usó insultos pierde pase lo que pase; si ambos, empate.

## Evidencia
- Resolver puro: `resolveDebateDuel({votesA, votesB, aInsulted?, bInsulted?})` (`modules/games/src/debate-duel.ts:57-89`). Prioridad de descalificación sobre votos (L74-86); votos saneados a enteros no negativos (`sanitizeVotes` L38-43); `margin` = diferencia absoluta.
- Cableado en chat: comando `/duelo_debate <votosA> <votosB>` en `apps/bot/src/bot-update.service.ts:15267-15277` — llama a `resolveDebateDuel` (L15273) y responde `🎤 Ganador: … (margen …)`.
- Import del símbolo: `apps/bot/src/bot-update.service.ts:357`.
- Tests: `modules/games/src/debate-duel.test.ts`.

## Estado / cableado
`implemented` como **comando manual/calculadora**: el usuario pasa los conteos de votos a mano; el comando no orquesta una votación real ni detecta insultos automáticamente (los flags `aInsulted`/`bInsulted` no se exponen en el comando). No hay superficie en la Mini App. Madurez `experimental`: es un passthrough fino del resolver puro.

## Preguntas abiertas
- ¿Existe un flujo de votación real (reacciones/encuesta) que alimente `votesA/votesB` y `aInsulted/bInsulted`? No verificado; el único cableado hallado es el comando manual.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Trivia de Estadísticas de Grupo]], [[Reto de Creatividad]], [[Batalla de Playlists]]
