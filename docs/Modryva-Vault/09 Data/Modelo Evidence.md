---
id: modryva-model-evidence
title: Modelo Evidence
type: model
domain: data
status: implemented
maturity: unknown
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo Evidence

## Propósito
Prueba adjunta a un [[Modelo ModerationCase]] (captura, referencia de archivo, nota). Tabla `evidence`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `caseId` | String | Contexto (caso). |
| `type` | String | Tipo de prueba. |
| `storageRef` / `note` | String? | Ubicación / nota. |

## Índices / restricciones
`@@index([tenantId, caseId])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado** (moderación no cableada). El flujo activo de pruebas/apelaciones usa
[[Modelo D1Appeal]] / [[Modelo QuarantineItem]]. Ver [[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo ModerationCase]], [[Modelo Appeal]], [[Database Map]]
