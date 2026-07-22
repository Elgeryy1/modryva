---
id: modryva-model-appeal
title: Modelo Appeal
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

# Modelo Appeal

## Propósito
Apelación de un [[Modelo AppUser]] sobre un caso de moderación. Tabla `appeals`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `caseId` | String | Contexto. |
| `userId` | String | FK → [[Modelo AppUser]] (`onDelete: Cascade`). |
| `status` | String | `@default("open")`. |
| `message` / `resolution` | String / String? | Texto y resolución. |

## Índices / restricciones
`@@index([tenantId, caseId, status])`. FK a `AppUser`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado**: el flujo de apelaciones activo usa en su lugar [[Modelo D1Appeal]]
(`d1-repository.ts`). Ver [[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (reemplazado por [[Modelo D1Appeal]])
- Relacionado con: [[Modelo ModerationCase]], [[Modelo AppUser]], [[Database Map]]
