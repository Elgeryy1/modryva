---
id: modryva-games-playlist-battle
title: Batalla de Playlists
type: feature
domain: games
status: partial
maturity: experimental
source:
  - modules/games/src/playlist-battle.ts
tags:
  - modryva
  - feature
  - games
aliases: ["playlist battle", "batalla de canciones"]
created: 2026-07-12
updated: 2026-07-12
---

# Batalla de Playlists

## Qué hace
Lógica pura para rankear canciones en una batalla de playlists por votos, asignando posiciones 1-based.

## Evidencia
- `resolvePlaylistBattle(songs)` (`modules/games/src/playlist-battle.ts:19-33`): ordena por votos descendente, desempate por `songId` ascendente, y asigna `rank` 1-based. No muta la entrada.
- Formas: `SongVotes{songId, votes}` (`playlist-battle.ts:2-5`), `SongRank{songId, votes, rank}` (`playlist-battle.ts:8-12`).
- Tests: `modules/games/src/playlist-battle.test.ts`.

## Estado / cableado
`partial`: **lógica pura sin cablear**. `resolvePlaylistBattle` no se importa fuera de `modules/games/src`. Comparte patrón "rankear por votos" con [[Reto de Creatividad]], pero sin flujo de recogida de canciones ni votación.

## Preguntas abiertas
- No hay integración con ninguna fuente musical ni con la votación del grupo; el módulo solo ordena una lista de canciones con votos ya contados.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Reto de Creatividad]], [[Duelo de Debate]], [[Torneo por Eliminatorias]]
