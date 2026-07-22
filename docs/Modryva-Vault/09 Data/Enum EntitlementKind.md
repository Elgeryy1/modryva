---
id: enum-entitlementkind
title: Enum EntitlementKind
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

# Enum EntitlementKind

Tipo de derecho/beneficio otorgado a un dueño (por promo, pago o manual).

## Valores

| Valor | Significado |
|---|---|
| `managed_bot_slot` | Ranura para crear/operar un bot hijo gestionado. |
| `pro_trial` | Prueba del plan Pro. |
| `agency_pack` | Paquete de agencia (multi-bot). |

Sin default: `kind` es obligatorio.

## Usado por

- [[Modelo PromoCode]] — campo `kind EntitlementKind` (qué otorgará el código).
- [[Modelo Entitlement]] — campo `kind EntitlementKind` (con `@@index([kind])`).

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo PromoCode]], [[Modelo Entitlement]]
- Relacionado con: [[Database Map]], [[Modryva Hub Map]], [[Enum EntitlementSource]]
