---
id: modryva-glossary-house-edge
title: House Edge
type: glossary
domain: glossary
status: implemented
maturity: stable
source:
  - modules/games/src/casino.ts
tags:
  - modryva
  - glossary
  - casino
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# House Edge

Ventaja de la casa: fracción esperada que retiene el casino a largo plazo. En Modryva es una constante
(`CASINO.houseEdge`, ~2%) que se aplica al calcular los multiplicadores de cada juego para que el retorno
esperado (EV) sea < 1 (p.ej. Keno EV ≈ 0.98 tras la auditoría). Ver [[Casino Bug Audit 2026-07]] y
[[Chip Economy]].

## Relaciones
- Relacionado con: [[Chip Economy]], [[Casino Map]], [[Provably Fair]]
