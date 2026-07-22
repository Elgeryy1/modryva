---
id: modryva-support-vertical-presets
title: Presets Verticales
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/vertical-presets.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Presets Verticales

## Qué hace
Presets "vendibles" que configuran el bot según el tipo de comunidad: `aula`,
`soporte` y `creadores`. Cada preset (`VerticalPreset`) define módulos a activar
(reusando nombres reales del repo: tickets, quizzes, reminders, misiones,
scheduling), un mensaje de bienvenida, reglas y comandos sugeridos.
- `parseVerticalCommand`: `/vertical <aula|soporte|creadores>` (errores
  `missing-kind` / `unknown-kind`).
- `resolveVerticalPreset(kind)` / `formatVerticalPreset(kind)`: resuelven y
  renderizan el preset como texto multilínea listo para enviar.

## Evidencia
- `modules/support/src/vertical-presets.ts:109` `parseVerticalCommand`;
  `vertical-presets.ts:78` `resolveVerticalPreset`; `vertical-presets.ts:148`
  `formatVerticalPreset`; presets en `vertical-presets.ts:28`.
- Test: `modules/support/src/vertical-presets.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:10061`
  (`parseVerticalCommand(update)`) y `bot-update.service.ts:10071`
  (`formatVerticalPreset(...)`) dentro de `handleVerticalCommand`.

## Estado / cableado
`implemented`: cableado a `handleVerticalCommand`. Renderiza el preset; no se
verificó que aplicar el preset active de verdad los módulos/reglas listados.

## Preguntas abiertas
- ¿`/vertical` solo muestra el preset o también lo aplica (activa módulos, fija
  bienvenida y reglas)? → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Recetas de Configuración]], [[Tickets de Soporte]], [[Recordatorios y Tareas]]
