---
id: modryva-model-welcomeconfig
title: Modelo WelcomeConfig
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/welcome-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo WelcomeConfig

## Propósito
Textos de bienvenida, despedida y reglas por chat. Tabla `welcome_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | String | `@unique`. |
| `welcomeText` / `goodbyeText` / `rulesText` | String? | Plantillas de texto. |

## Índices / restricciones
`chatId @unique`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`welcome-repository.ts` (get/set de textos). Ver [[Welcome]], [[Módulo community]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Welcome]]
- Relacionado con: [[Modelo GroupHygieneConfig]], [[Modelo Chat]], [[Database Map]]
