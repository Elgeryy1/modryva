---
id: enum-auditactortype
title: Enum AuditActorType
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - model
  - data
  - enum
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Enum AuditActorType

Tipo de actor que originó una entrada de [[Modelo AuditLog]].

## Valores

| Valor | Significado |
|---|---|
| `user` | Acción de un usuario humano. |
| `bot` | Acción del bot. |
| `system` | Proceso interno (valor por defecto: `@default(system)`). |
| `integration` | Integración/servicio externo. |

## Usado por

- [[Modelo AuditLog]] — campo `actorType AuditActorType @default(system)`.

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo AuditLog]]
- Relacionado con: [[Database Map]]
