---
id: modryva-model-secretref
title: Modelo SecretRef
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

# Modelo SecretRef

## Propósito
Referencia (no el valor) a un secreto guardado en un proveedor externo (vault/KMS). Tabla `secrets_refs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String? | Tenant. |
| `name` | String | Nombre lógico. |
| `provider` | String | Proveedor. |
| `reference` | String | Puntero al secreto. |

## Índices / restricciones
`@@unique([tenantId, name])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado**. Los tokens reales de bot se cifran en [[Modelo ManagedBot]]
(`encryptedToken`), no aquí. Ver [[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo ManagedBot]], [[Security Map]], [[Database Map]]
