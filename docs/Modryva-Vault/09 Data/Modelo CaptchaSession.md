---
id: modryva-model-captchasession
title: Modelo CaptchaSession
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

# Modelo CaptchaSession

## Propósito
Reto de captcha en curso para un usuario recién entrado: challenge, respuesta (hash+salt), intentos y
caducidad. Tabla `captcha_sessions`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `userId` | String? | Usuario interno. |
| `telegramUserId` | BigInt | Usuario Telegram. |
| `mode` | [[Enum CaptchaMode]] | Tipo de reto. |
| `challenge` | String | Enunciado. |
| `answerHash` / `answerSalt` | String? | Respuesta protegida. |
| `status` | String | `@default("pending")`. |
| `attempts` / `maxAttempts` | Int | Intentos. |
| `failAction` | String | `@default("ban")`. |
| `expiresAt` / `resolvedAt` | DateTime | Vigencia. |

## Índices / restricciones
`@@index([tenantId, chatId, status])`, `@@index([tenantId, telegramUserId, status])`.

## Enums usados
[[Enum CaptchaMode]]

## Acceso
`captcha-repository.ts` (crear reto, validar respuesta, caducar).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: —
- Relacionado con: [[Modelo CaptchaConfig]], [[Modelo VerifiedUser]], [[Database Map]]
