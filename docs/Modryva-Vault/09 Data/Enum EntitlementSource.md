---
id: enum-entitlementsource
title: Enum EntitlementSource
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

# Enum EntitlementSource

Origen por el que se creó un [[Modelo Entitlement]].

## Valores

| Valor | Significado |
|---|---|
| `promo` | Concedido al canjear un [[Modelo PromoCode]]. |
| `payment` | Concedido por un pago. |
| `manual` | Concesión manual por un admin de plataforma. |

Sin default: `source` es obligatorio.

## Usado por

- [[Modelo Entitlement]] — campo `source EntitlementSource`.

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Entitlement]]
- Relacionado con: [[Database Map]], [[Modryva Hub Map]], [[Enum EntitlementKind]]
