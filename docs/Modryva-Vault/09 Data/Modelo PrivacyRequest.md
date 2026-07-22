---
id: modryva-model-privacyrequest
title: Modelo PrivacyRequest
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

# Modelo PrivacyRequest

## Propósito
Solicitud de privacidad (acceso/borrado de datos, estilo GDPR) de un usuario. Tabla `privacy_requests`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `userId` | String? | Contexto. |
| `kind` | String | Tipo de solicitud. |
| `status` | String | `@default("open")`. |
| `payload` | Json? | Detalles. |

## Índices / restricciones
`@@index([tenantId, status])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado** (andamiaje de cumplimiento no cableado). Ver [[Data Model Overview]]
y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo AppUser]], [[Modelo Tenant]], [[Database Map]]
