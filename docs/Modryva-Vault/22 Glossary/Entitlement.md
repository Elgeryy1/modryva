---
id: modryva-glossary-entitlement
title: Entitlement
type: glossary
domain: glossary
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - glossary
  - platform
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Entitlement

Derecho/permiso de producto que desbloquea funciones Pro (frente a las gratuitas). Se concede por códigos
promo o compras y se consulta al gatear features. Cadena: [[Modelo PromoCode]] → [[Modelo PromoRedemption]]
→ [[Modelo Entitlement]] (con [[Enum EntitlementKind]] / [[Enum EntitlementSource]]). Gestión:
[[Promo Codes y Entitlements]], [[Controller entitlement]].

## Relaciones
- Relacionado con: [[Modelo Entitlement]], [[Promo Codes y Entitlements]], [[Modryva Hub Map]]
