---
id: enum-policyaction
title: Enum PolicyAction
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
  - enum
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Enum PolicyAction

Acción a ejecutar cuando una `PolicyRule` coincide.

## Valores

| Valor | Significado |
|---|---|
| `allow` | Permitir. |
| `warn` | Avisar. |
| `delete` | Borrar el mensaje. |
| `mute` | Silenciar. |
| `ban` | Expulsar. |
| `review` | Enviar a revisión manual. |

Sin default: `action` es obligatorio en la regla.

## Usado por

- `PolicyRule` — campo `action PolicyAction` (tabla `policy_rules`).

> Nota: `PolicyRule` no tiene repositorio verificado que lo consulte (schema-only). Ver [[Open Questions]].

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: `PolicyRule`
- Relacionado con: [[Database Map]], [[Security Map]]
