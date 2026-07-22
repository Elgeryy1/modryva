---
id: modryva-guia-anadir-modulo
title: Guía Añadir un Módulo
type: guide
domain: developer
status: implemented
maturity: stable
source:
  - modules
  - tsconfig.base.json
tags:
  - modryva
  - guide
  - developer
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Guía — añadir un módulo (o una feature a un módulo)

Los módulos (`@superbot/module-*`) contienen **lógica de dominio pura y testeable**
([[ADR-004 Lógica de dominio pura y testeable por fichero]]), sin I/O de Telegram ni BD. Las apps
(bot/api/worker) importan y orquestan esa lógica.

## Patrón "una feature por fichero"
- Crea `modules/<dominio>/src/<feature>.ts` con **funciones puras y deterministas** (entrada → salida, sin
  efectos secundarios).
- Crea su hermano `modules/<dominio>/src/<feature>.test.ts` (Vitest). Hay ~497 tests así; es la red de
  seguridad del proyecto ([[Testing Strategy]]).
- Exporta la feature desde el `index.ts` del módulo para que las apps la importen.

## Módulo nuevo (paquete)
1. Carpeta `modules/module-<nombre>/` con su `package.json` (`@superbot/module-<nombre>`) y `src/index.ts`.
2. Se integra por pnpm workspaces + Turborepo (no hay que tocar build central salvo dependencias).
3. Cablea la lógica desde la app que la use (normalmente el bot → ver [[Guía Añadir un Comando]]).

## Cuidado con `exactOptionalPropertyTypes`
`tsconfig.base.json` tiene `exactOptionalPropertyTypes: true`: pasar `campo: posibleUndefined` a un
`campo?: T` es error. Usa **spread condicional**: `...(x != null ? { campo: x } : {})`. Este patrón se repite
por todo el código. Ver [[Riesgo Build web más estricto que typecheck local]].

## Trampa: lógica pura sin cablear
Es fácil crear una feature perfecta y testeada que **nadie invoca** (no hay comando/UX). Márcalo `partial`
en el Vault y añádelo al [[Roadmap Wiring Idea Bank]]. Ver [[Riesgo Features de lógica pura sin cablear]].

## Checklist
- [ ] `<feature>.ts` + `<feature>.test.ts` (puros).
- [ ] Export en `index.ts`.
- [ ] Cableado real (comando/evento/job) — si no, es `partial`.
- [ ] Nota en el Vault: `Módulo <x>` o feature (ver [[Conventions]]).

## Relaciones
- Pertenece a: [[Developer Onboarding Map]]
- Depende de: [[Modules Map]], [[Testing Strategy]]
- Relacionado con: [[ADR-004 Lógica de dominio pura y testeable por fichero]], [[Guía Añadir un Comando]], [[Riesgo Features de lógica pura sin cablear]]
