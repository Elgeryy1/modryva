---
id: moc-onboarding
title: Developer Onboarding Map
type: moc
domain: operations
status: partial
maturity: beta
tags:
  - modryva
  - moc
  - operations
  - onboarding
created: 2026-07-12
updated: 2026-07-12
---

# Developer Onboarding Map

Ruta para entender y contribuir a Modryva desde cero. Notas en `14 Operations/`. Doc del equipo:
`docs/DEVELOPMENT.md`.

## 1. Entender el proyecto

[[Modryva Home]] → [[Repository Inventory]] → [[Arquitectura General]] → [[Bot Pipeline]].

## 2. Entorno local

- [[Local Development Setup]] — pnpm workspaces (pnpm **no** en PATH → binarios de `node_modules`), Docker,
  variables de entorno ([[Env Vars]]), base de datos ([[Runbook Migraciones Prisma]]).
- [[Runbook Ver Logs]] · [[Runbook Desplegar]].

## 3. Cómo añadir cosas (guías)

- [[Guía Añadir un Comando]] · [[Guía Añadir un Módulo]] · [[Guía Añadir un Evento]] ·
  [[Guía Añadir una Tabla]] · [[Guía Añadir una Integración]] · [[Guía Depurar un Error]].

## 4. Convenciones

[[Conventions]] (del Vault) · patrón feature-por-fichero de los módulos ([[Modules Map]]) · tests con Vitest
([[Testing Map]]).

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Operations Map]], [[Architecture Map]], [[Testing Map]]
