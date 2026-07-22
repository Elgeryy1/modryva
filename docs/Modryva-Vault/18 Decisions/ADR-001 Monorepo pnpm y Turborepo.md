---
id: modryva-adr-001
title: ADR-001 Monorepo pnpm y Turborepo
type: decision
domain: decision
status: inferred
maturity: stable
source:
  - pnpm-workspace.yaml
  - turbo.json
tags:
  - modryva
  - decision
  - architecture
created: 2026-07-12
updated: 2026-07-12
---

# ADR-001 — Monorepo pnpm y Turborepo

## Estado
**inferred**.

## Contexto
El proyecto tiene 4 apps + 5 paquetes + 10 módulos con dependencias cruzadas (`@superbot/*`) y necesita
compartir tipos/lógica sin publicar paquetes.

## Decisión
Un **monorepo** con **pnpm workspaces** (`pnpm-workspace.yaml`) y orquestación de tareas con **Turborepo**
(`turbo.json`); lint/format con Biome; tests con Vitest.

## Evidencia en el repositorio
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `biome.json`, `vitest.config.ts`; los 19 `package.json`
`@superbot/*`.

## Alternativas
Multirepo (más fricción para compartir), npm/yarn workspaces (pnpm elegido por disco/velocidad).

## Consecuencias positivas
Compartir código sin publicar, refactors atómicos, build cacheado.

## Consecuencias negativas
`pnpm` no está en el PATH del entorno del usuario → hay que invocar binarios de `node_modules`
(ver [[Local Development Setup]]). Un God Object en el bot pese al modularidad ([[Riesgo God Object bot-update]]).

## Componentes afectados
[[Arquitectura General]] · [[Monorepo Layout]] · todos los [[Modules Map]].

## Relaciones
- Pertenece a: [[Decisions Map]]
- Relacionado con: [[Arquitectura General]]
