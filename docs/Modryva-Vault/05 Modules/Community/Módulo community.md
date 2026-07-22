---
id: modulo-community
title: Módulo community
type: module
domain: community
status: implemented
maturity: beta
source: [modules/community/src/index.ts, modules/community/package.json, apps/bot/src/bot-update.service.ts]
tags: [modryva, module, community]
aliases: [community, module-community, "@superbot/module-community"]
created: 2026-07-12
updated: 2026-07-12
---

# Módulo community

Paquete `@superbot/module-community` (`modules/community/package.json:2`). Es el catálogo de features "de comunidad" de Modryva: bienvenidas, encuestas, filtros, comandos personalizados, AFK, sorteos, misiones cooperativas, gratitud, estadísticas de actividad, juegos ligeros (fun) y un largo etcétera de módulos de análisis.

## Patrón: una feature por fichero, lógica pura

`modules/community/src/` contiene ~139 ficheros de lógica (`*.ts`) más sus tests (`*.test.ts`). El barril `index.ts` reexporta 138 de ellos (`modules/community/src/index.ts:1-138`).

La convención del módulo es **lógica pura y determinista**: cada fichero exporta parsers de comandos, funciones de render/formato y cálculos que **no hacen I/O, no tocan Prisma, ni red, ni `Date.now()`/`Math.random()`** (documentado explícitamente en varias cabeceras, p. ej. `coop-missions.ts:1-6`, `fun.ts:64-68`, `afk.ts:29`). El estado y el reloj se inyectan desde el llamador (el bot o el worker), que es quien persiste y decide.

## Cableado vs. pura lógica

- **Cableado (`implemented`)**: la app `apps/bot` importa ~200 símbolos de este paquete (`apps/bot/src/bot-update.service.ts:120-313`) y registra handlers por feature. Cada feature user-facing tiene un handler nombrado en `bot-update.service.ts` (p. ej. `coop-mission.command`, `gratitude.command`, `welcome.command`, `filters.command`, `poll.command`, `giveaway.command`, `custom-command.config`, `afk.command`, `stats.command`, `fun.command`). El `index.ts` de `community` **no** contiene recap: el [[Recap Semanal]] vive en el worker (`apps/worker/src/recap-processor.ts`).
- **Pura lógica no surfaceada (`partial`)**: muchos ficheros son helpers de análisis (p. ej. `polarization.ts`, `subculture-map.ts`, `conflict-risk.ts`, `silence-curve.ts`). Algunos se importan como helpers dentro de flujos de "owner summary"/analítica; otros no tienen aún un comando o job propio. Determinar el estado exacto de cada uno de los 139 ficheros exige trazado símbolo a símbolo — ver Open Questions.

## Features documentadas (cableadas)

Bienvenida/reglas → [[Welcome]] · Encuestas → [[Polls]] · Comandos custom → [[Custom Commands]] · Filtros → [[Filters]] · AFK → [[AFK]] · Sorteos → [[Giveaways]] · Misiones cooperativas → [[Coop Missions]] · Gratitud → [[Gratitude Points]] · Estadísticas → [[Activity y Analytics]] · Juegos ligeros → [[Fun]] · Panel de ajustes → [[Settings Panel]] · Modo silencio → [[Quiet Mode]] · Resumen semanal → [[Recap Semanal]].

Features conceptualmente "de comunidad" pero cuyo código vive en **otros módulos**: [[Trivia Comunitaria]] (`module-games` + worker), [[Reminders]] (`module-support`).

## Relaciones

- **Pertenece a**: [[Modules Map]]
- **Depende de**: `@superbot/domain` (tipo `TelegramUpdateEnvelope`)
- **Utilizado por**: `apps/bot` (`bot-update.service.ts`), `apps/worker` (`recap-processor.ts`)
- **Relacionado con**: [[Database Map]], [[Commands Map]], [[Events Map]]
