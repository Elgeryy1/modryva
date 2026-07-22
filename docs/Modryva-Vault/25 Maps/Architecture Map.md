---
id: moc-architecture
title: Architecture Map
type: moc
domain: architecture
status: implemented
maturity: beta
tags:
  - modryva
  - moc
  - architecture
created: 2026-07-12
updated: 2026-07-12
---

# Architecture Map

Índice del dominio de arquitectura: cómo está organizado el monorepo `superbot` y cómo encajan sus piezas.
Fuente de verdad del equipo: `docs/ARCHITECTURE.md`. Notas detalladas creadas en `03 Architecture/`.

## Visión

- [[Arquitectura General]] — el todo: monorepo pnpm + Turborepo, flujo bot↔api↔web↔worker↔postgres/redis.
- [[Monorepo Layout]] — mapa de carpetas.

## Apps (`apps/`)

- [[App bot]] — bot de Telegram (long-polling, `@ModryvaBot`).
- [[App api]] — NestJS + Fastify, sirve la Mini App / panel.
- [[App web]] — Next.js 15, Mini App / panel web.
- [[App worker]] — jobs, colas, RSS, recaps.

## Paquetes (`packages/`)

- [[Package domain]] · [[Package telegram]] · [[Package data]] · [[Package shared]] · [[Package auth]]

## Módulos (`modules/`)

Ver [[Modules Map]] para los 10 módulos de dominio.

## Relacionado

- [[Bot Core Map]] · [[Database Map]] · [[API Map]] · [[Infrastructure Map]]
- Decisiones: [[Decisions Map]] (ADRs de arquitectura).

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Bot Core Map]], [[Modules Map]], [[Database Map]], [[Infrastructure Map]]
