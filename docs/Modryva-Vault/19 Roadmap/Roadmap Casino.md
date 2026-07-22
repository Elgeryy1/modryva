---
id: modryva-roadmap-casino
title: Roadmap Casino
type: roadmap
domain: roadmap
status: partial
maturity: stable
source:
  - docs/casino-roadmap.md
  - apps/web/components/casino
tags:
  - modryva
  - roadmap
  - casino
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Roadmap — Casino social

## Estado
**partial (pausado).** Las 4 fases base del casino están **hechas y desplegadas** (juego nativo en chat +
mesa en la Mini App + economía de fichas + compra con Telegram Stars), y se corrigió una auditoría de
[[Casino Bug Audit 2026-07|21 bugs]]. El trabajo está **pausado** (se priorizó la Plataforma multi-bot). Plan
de reanudación en `docs/casino-roadmap.md`.

## Pendiente (según el roadmap)
- [[Roadmap Jackpot progresivo]] — bote acumulado entre partidas/jugadores.
- [[Roadmap Torneos casino]] — competición con ranking y premios en fichas.
- **Clanes** — grupos de jugadores con progreso compartido.
- **Referidos** — recompensa por invitar (reusa datos de invites existentes).
- **Side-betting** — apuestas paralelas sobre partidas en curso.
- **Pulido de UI** de la mesa.

## Guardarraíl (no negociable)
Todo esto se construye sobre fichas **virtuales no canjeables** por dinero real
([[ADR-005 Fichas virtuales no canjeables (guardrail legal)]]) y fairness verificable (provably-fair).

## Relaciones
- Pertenece a: [[Roadmap Map]]
- Depende de: [[Casino Map]], [[Servicio casino]]
- Relacionado con: [[Roadmap Jackpot progresivo]], [[Roadmap Torneos casino]], [[ADR-005 Fichas virtuales no canjeables (guardrail legal)]]
