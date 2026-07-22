---
id: moc-testing
title: Testing Map
type: moc
domain: testing
status: implemented
maturity: stable
tags:
  - modryva
  - moc
  - testing
created: 2026-07-12
updated: 2026-07-12
---

# Testing Map

Estrategia de tests. **497 ficheros `*.test.ts`** (Vitest, `vitest.config.ts`). Notas en `15 Testing/`.

## Cobertura por zona (nº de tests)

- `modules/community` 138 · `modules/security` 121 · `modules/support` 78 · `modules/games` 71 ·
  `modules/automation` 32 · `modules/ai` 8 · resto (core/files/payments) 3.
- Apps: `apps/worker` (recap, expiration, rss, trivia-announce, webhook), `apps/bot` (bot-update.service.test.ts).

## Patrón

Casi toda la lógica de dominio es **pura + testeada** (cada feature `x.ts` con su `x.test.ts` hermano).
Esto es la mayor fortaleza del repo. Ver [[Testing Strategy]] y [[Riesgo Features de lógica pura sin cablear]]
(muchos tests cubren lógica que aún no está cableada a UX).

## Cómo correr

`node node_modules/vitest/vitest.mjs run <ruta>` (pnpm no está en PATH). Ver [[Local Development Setup]].

## Huecos

- Módulos con pocos/ningún test relativos a su tamaño → [[Módulos sin tests]] (dashboard).

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Modules Map]], [[Developer Onboarding Map]], [[Risks and Technical Debt Map]]
