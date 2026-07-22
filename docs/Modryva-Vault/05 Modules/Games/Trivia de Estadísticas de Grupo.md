---
id: modryva-games-group-stat-trivia
title: Trivia de Estadísticas de Grupo
type: feature
domain: games
status: implemented
maturity: experimental
source:
  - modules/games/src/group-stat-trivia.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - games
aliases: [adivina_stat, "guess the stat"]
created: 2026-07-12
updated: 2026-07-12
---

# Trivia de Estadísticas de Grupo

## Qué hace
Juego de "adivina la estadística del grupo": el jugador propone un número y se compara con el valor real. Acierta si el error está dentro de una tolerancia (10% por defecto); los puntos bajan cuanto más lejos anda la estimación.

## Evidencia
- Scoring puro: `scoreStatGuess({guess, actual}, {tolerancePct?})` (`modules/games/src/group-stat-trivia.ts:34-48`). Tolerancia por defecto 10% (`group-stat-trivia.ts:25`); aciertos ganan `max(1, round(10 - errorPct))` puntos (L46); con `actual === 0` solo un `guess` exacto acierta (L40-43).
- Cableado en chat: comando `/adivina_stat <adivinado> <real>` en `apps/bot/src/bot-update.service.ts:15839-15851` — llama a `scoreStatGuess` (L15845) y responde acierto/fallo con puntos u `offBy`.
- Import del símbolo: `apps/bot/src/bot-update.service.ts:362`.
- Tests: `modules/games/src/group-stat-trivia.test.ts`.

## Estado / cableado
`implemented` como **comando manual/calculadora**: los dos números (adivinado y real) se pasan a mano por argumento; el comando no consulta ninguna estadística real del grupo ni reparte puntos al leaderboard. Madurez `experimental`: passthrough fino del scorer puro.

## Preguntas abiertas
- ¿Se conecta a alguna métrica real del grupo (mensajes, miembros activos) para autogenerar el `actual`? No verificado; solo existe el comando manual.
- Los puntos calculados no se persisten en `GameScore` desde este comando (solo se muestran en el texto).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Duelo de Debate]], [[Trivia Diaria de Grupo]], [[Banco de Trivia]]
