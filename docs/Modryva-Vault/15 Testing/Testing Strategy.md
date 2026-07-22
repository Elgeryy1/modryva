---
id: modryva-testing-strategy
title: Testing Strategy
type: reference
domain: testing
status: implemented
maturity: stable
source:
  - vitest.config.ts
  - modules
tags:
  - modryva
  - testing
aliases:
  - Estrategia de Tests
created: 2026-07-12
updated: 2026-07-12
---

# Testing Strategy

## Resumen
El proyecto apuesta por **muchos tests unitarios de lógica pura** con [[Integración Vitest|Vitest]], no por
una pirámide con e2e pesados. La táctica nace de [[ADR-004 Lógica de dominio pura y testeable]]: cada feature
vive en `x.ts` con un hermano `x.test.ts` que la prueba sin arrancar Telegram ni BD.

## Qué está cubierto (implementado)
- **497 ficheros `*.test.ts`** en el repo (conteo por búsqueda de ficheros).
- Concentración por módulo: `modules/community` (~139 ficheros de feature), `modules/security` (~124),
  `modules/games` (~72) — la lógica de moderación, comunidad y juegos es la más testeada.
- **Provably-fair del casino**: `fairness.ts` y los resolvers de cada juego se testean de forma
  determinista (semilla → resultado), ver [[Casino Map]] / [[Casino Map]].

## Qué NO está cubierto (o desconocido)
- **e2e reales contra Telegram**: `unknown` / no hay evidencia de suite e2e que hable con la Bot API.
- **Tests de integración de la Mini App** (web) contra la API: `unknown`.
- El **cableado** de features (bot-update → handler): al ser lógica pura, muchos tests validan la función
  pero no que esté conectada a un comando/callback → ver [[Riesgo Features de lógica pura sin cablear]].

## Cómo se ejecutan
```bash
# suite completa (turbo orquesta los paquetes)
node node_modules/vitest/vitest.mjs run       # o el script de package.json equivalente
```
`pnpm` no está en PATH en este entorno → se invoca el binario de `node_modules` (mismo patrón que
[[Runbook Migraciones Prisma]]).

## Interpretación
Alta confianza en la **corrección de la lógica** (algoritmos, moderación, fairness) y baja garantía
automática sobre la **integración extremo a extremo**; ese hueco se cubre con pruebas manuales en vivo
(userbot GramJS) documentadas fuera del Vault.

## Relaciones
- Pertenece a: [[Testing Map]]
- Deriva de: [[ADR-004 Lógica de dominio pura y testeable]]
- Relacionado con: [[Riesgo Features de lógica pura sin cablear]], [[Modules Map]], [[Casino Map]]
