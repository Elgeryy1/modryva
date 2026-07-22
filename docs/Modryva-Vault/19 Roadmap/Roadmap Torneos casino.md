---
id: modryva-roadmap-torneos-casino
title: Roadmap Torneos casino
type: roadmap
domain: roadmap
status: planned
maturity: unknown
source:
  - docs/casino-roadmap.md
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - roadmap
  - casino
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Roadmap — Torneos de casino

## Estado
**planned.** Existe el modelo [[Modelo Tournament]] en el esquema, pero el flujo de torneo (inscripción,
ronda, ranking, premios) no está implementado end-to-end (`unknown` el alcance actual del modelo).

## Idea
Competiciones por tiempo o por rondas donde los jugadores acumulan puntos/fichas y se premia a los mejores
del ranking. Reusa la economía ([[Chip Economy]]) y el ranking/leaderboard de comunidad. Premios en fichas
virtuales (guardarraíl [[ADR-005 Fichas virtuales no canjeables (guardrail legal)]]).

## Preguntas abiertas
- Formato (eliminación, liga, contrarreloj) y cadencia: `unknown`.
- Antitrampa en torneos con premio: `unknown`.

## Relaciones
- Pertenece a: [[Roadmap Map]]
- Parte de: [[Roadmap Casino]]
- Depende de: [[Modelo Tournament]], [[Chip Economy]]
- Relacionado con: [[Salón de la Fama]]
