---
id: modryva-module-files
title: Módulo files
type: module
domain: module
status: partial
maturity: alpha
source:
  - modules/files/src
tags:
  - modryva
  - module
  - files
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Módulo files

## Propósito
Gestión de archivos/assets del bot. Paquete mínimo `@superbot/module-files` (`files.ts` + `index.ts`, 1 test).

## Datos
[[Modelo FileAsset]].

## Cableado
`partial`: módulo pequeño; confirmar qué comandos/flows lo usan (subida, referencia de assets). Ver
`docs/COMMANDS.md` sección "Archivos (Fase 4)".

## Relaciones
- Pertenece a: [[Modules Map]]
- Consume: [[Modelo FileAsset]]
- Relacionado con: [[Product Map]]
