---
id: modryva-support-recipes
title: Recetas de Configuración
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/recipes.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Recetas de Configuración

## Qué hace
Recetas de configuración compartibles: serializa un objeto de config plano a un
código corto exportable y lo reimporta validando el formato.
- `encodeConfigRecipe(config)`: JSON estable (claves ordenadas) → base64url con
  prefijo de versión `r1.`; la misma config produce siempre el mismo token.
- `decodeConfigRecipe(token)`: valida prefijo, base64url y que el payload sea un
  objeto plano; devuelve `{ ok, config }` o `{ ok:false, error }` sin lanzar.
- `diffConfigRecipe(current, incoming)`: cambios campo a campo (por igualdad
  estructural) antes de aplicar una receta entrante.

## Evidencia
- `modules/support/src/recipes.ts:192` `encodeConfigRecipe`; `recipes.ts:200`
  `decodeConfigRecipe`; `recipes.ts:238` `diffConfigRecipe`; prefijo en
  `recipes.ts:27`.
- Test: `modules/support/src/recipes.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:10302`
  (`decodeConfigRecipe(code)`) y `bot-update.service.ts:10321`
  (`encodeConfigRecipe(current)`) dentro de `handleRecipeCommand`.

## Estado / cableado
`implemented`: cableado a `handleRecipeCommand` (importar/exportar config por
código).

## Preguntas abiertas
- Qué campos de config concretos entran en una receta y cómo se aplican (¿con
  confirmación del diff?) se resuelve en el handler → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Presets Verticales]]
