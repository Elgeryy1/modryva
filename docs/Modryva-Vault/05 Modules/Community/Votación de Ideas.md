---
id: modryva-community-votacion-ideas
title: Votación de Ideas
type: feature
domain: community
status: implemented
maturity: experimental
source:
  - modules/community/src/idea-voting.ts
tags:
  - modryva
  - feature
  - community
aliases: [ideas, idea voting, votacion, roadmap]
created: 2026-07-12
updated: 2026-07-12
---

# Votación de Ideas

## Qué hace
Los miembros proponen y votan ideas (p. ej. qué módulo/feature va después). `/ideas list` muestra el ranking; `/ideas add <título>` propone (requiere permiso). El ranking ordena por votos desc, con desempate por título.

## Evidencia
- `VotedIdea { id, title, votes }` y `RankedIdea` con `rank` 1-based (`modules/community/src/idea-voting.ts:5-20`).
- `rankVotedIdeas(ideas)` ordena por votos desc, empate por título (insensible→sensible), sin mutar la entrada (`idea-voting.ts:30-59`).
- Test: `modules/community/src/idea-voting.test.ts`.

## Estado / cableado
Implemented. Handler `/ideas` (`apps/bot/src/bot-update.service.ts:12722+`): lee/guarda el banco en `chatSettingRepository` bajo la clave `idea_bank` (`bot-update.service.ts:12733-12738`), lista con `rankVotedIdeas` (`:12746`) y `add` exige permiso `idea-voting.config` (`:12754-12762`). Imports en `bot-update.service.ts:274,312` (`VotedIdea`).

## Preguntas abiertas
- Mecánica de voto (subcomando `vote`/uno-por-usuario, anti-duplicado) no se leyó completa aquí → `unknown` (parcialmente).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Polls]], [[Comando ideas]]
