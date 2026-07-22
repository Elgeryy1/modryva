---
id: modryva-roadmap-jackpot
title: Roadmap Jackpot progresivo
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

# Roadmap — Jackpot progresivo del casino

## Estado
**planned.** Existe el modelo [[Modelo Jackpot]] en el esquema, pero el bote progresivo (acumulación entre
partidas/jugadores + condición de disparo + reparto) no está implementado end-to-end (`unknown` el alcance
actual del modelo).

## Idea
Una fracción de cada apuesta alimenta un bote común que crece hasta que un evento raro y **provably-fair** lo
reparte. Debe integrarse con la economía existente ([[Chip Economy]], [[Modelo ChipLedger]]) sin romper el
guardarraíl de fichas no canjeables ([[ADR-005 Fichas virtuales no canjeables (guardrail legal)]]).

## Preguntas abiertas
- ¿Qué juegos contribuyen y con qué porcentaje? `unknown`.
- ¿Cómo se garantiza la equidad del disparo (semilla/HMAC)? `unknown`.

## Relaciones
- Pertenece a: [[Roadmap Map]]
- Parte de: [[Roadmap Casino]]
- Depende de: [[Modelo Jackpot]], [[Chip Economy]]
- Relacionado con: [[Provably Fair]]
