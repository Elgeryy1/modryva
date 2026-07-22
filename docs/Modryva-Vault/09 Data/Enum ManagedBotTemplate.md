---
id: enum-managedbottemplate
title: Enum ManagedBotTemplate
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

# Enum ManagedBotTemplate

Plantilla/perfil con el que se crea un bot hijo. Determina la configuración inicial.

## Valores

| Valor | Significado |
|---|---|
| `community` | Comunidad (valor por defecto en varios modelos). |
| `creator` | Creador de contenido. |
| `support` | Soporte. |
| `business` | Negocio. |
| `custom` | Personalizado. |

## Usado por

- [[Modelo ManagedBot]] — `template ManagedBotTemplate @default(community)`.
- [[Modelo PromoCode]] — `template ManagedBotTemplate @default(community)` (plantilla que otorgará el código).
- [[Modelo Entitlement]] — `template ManagedBotTemplate @default(community)`.

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo ManagedBot]], [[Modelo PromoCode]], [[Modelo Entitlement]]
- Relacionado con: [[Database Map]], [[Modryva Hub Map]]
