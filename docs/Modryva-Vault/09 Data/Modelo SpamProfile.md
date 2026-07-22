---
id: modryva-model-spamprofile
title: Modelo SpamProfile
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

# Modelo SpamProfile

## Propósito
Perfil de detección de spam con umbral y `config` por tenant/chat. Tabla `spam_profiles`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` | String | Tenant. |
| `chatId` | String? | Chat (opcional). |
| `name` | String | Nombre del perfil. |
| `threshold` | Int | `@default(0)`. |
| `config` | Json? | Reglas. |

## Índices / restricciones
`@@unique([tenantId, chatId, name])`.

## Enums usados
Ninguno.

## Acceso
**Sin lector/escritor verificado**. El antispam efectivo se apoya en [[Modelo BlocklistConfig]],
[[Modelo GroupHygieneConfig]] y detectores sobre [[Modelo ChatActivityEvent]]. Ver
[[Data Model Overview]] y [[Open Questions]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: — (sin cablear)
- Relacionado con: [[Modelo BlocklistConfig]], [[Modelo GroupHygieneConfig]], [[Database Map]]
