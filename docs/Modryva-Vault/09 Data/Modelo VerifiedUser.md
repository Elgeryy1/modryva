---
id: modryva-model-verifieduser
title: Modelo VerifiedUser
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/group-protection-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo VerifiedUser

## Propósito
Marca de usuario ya verificado en un tenant (p. ej. superó captcha), para no volver a exigírselo.
Tabla `verified_users`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `telegramUserId` | BigInt | Usuario verificado. |

## Índices / restricciones
`@@unique([tenantId, telegramUserId])`.

## Enums usados
Ninguno.

## Acceso
`group-protection-repository.ts` (marcar/consultar verificación).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo CaptchaSession]], [[Modelo GroupMembershipGate]]
- Relacionado con: [[Modelo Chat]], [[Database Map]]
