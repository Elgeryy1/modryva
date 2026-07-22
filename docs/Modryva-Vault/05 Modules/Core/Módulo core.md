---
id: modryva-module-core
title: Módulo core
type: module
domain: module
status: implemented
maturity: stable
source:
  - modules/core/src
tags:
  - modryva
  - module
  - core
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Módulo core

## Propósito
Núcleo compartido de los módulos: manifiesto de módulos y contrato de plataforma. Paquete
`@superbot/module-core` (`index.ts`, `manifest.ts`, `platform.ts`; 1 test).

## Ficheros
- `manifest.ts` — declaración/registro de módulos (relacionado con la cuenta de "módulos activos" que
  aparece en la UI; ver la discrepancia 9/10/11 en [[Open Questions]] #1).
- `platform.ts` — contrato/base de plataforma que consumen los demás módulos.

## Cableado
`implemented`: base usada transversalmente. Confirmar exactamente qué expone `manifest.ts` respecto al
conteo de módulos.

## Relaciones
- Pertenece a: [[Modules Map]]
- Utilizado por: [[Modules Map]] (todos los módulos)
- Relacionado con: [[Modelo ModuleState]], [[Modryva Hub Map]]
