---
id: modryva-glossary-tenant
title: Tenant
type: glossary
domain: glossary
status: implemented
maturity: stable
tags:
  - modryva
  - glossary
  - platform
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Tenant

Unidad de aislamiento multi-inquilino de Modryva. Casi todos los datos se scopan por `tenantId` (p.ej. las
wallets del casino son por `(tenantId, telegramUserId)`). Un tenant se corresponde con un contexto de bot
(el padre o un bot hijo). Modelo: [[Modelo Tenant]]. Cómo se resuelve un update a su tenant: [[Bot Scoping]].

## Relaciones
- Relacionado con: [[Modelo Tenant]], [[Bot Scoping]], [[Modryva Hub Map]]
