---
id: modryva-model-captchaconfig
title: Modelo CaptchaConfig
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/captcha-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo CaptchaConfig

## Propósito
Config de captcha de entrada por chat: modo, timeout, intentos y acción al fallar. Tabla
`captcha_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | String | `@unique`. |
| `enabled` | Boolean | `@default(false)`. |
| `mode` | [[Enum CaptchaMode]] | `@default(button)`. |
| `timeoutSeconds` / `maxAttempts` | Int | Límites. |
| `failAction` | String | `@default("ban")`. |

## Índices / restricciones
`chatId @unique`; `@@index([tenantId])`.

## Enums usados
[[Enum CaptchaMode]]

## Acceso
`captcha-repository.ts` (config; crear/resolver [[Modelo CaptchaSession]]). Ver [[Módulo security]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo CaptchaSession]]
- Relacionado con: [[Modelo Chat]], [[Database Map]]
