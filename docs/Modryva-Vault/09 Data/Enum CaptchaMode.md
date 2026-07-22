---
id: enum-captchamode
title: Enum CaptchaMode
type: model
domain: data
status: implemented
maturity: stable
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

# Enum CaptchaMode

Modalidad del reto captcha aplicado a nuevos miembros.

## Valores

| Valor | Significado |
|---|---|
| `button` | Pulsar un botón (valor por defecto en [[Modelo CaptchaConfig]]: `@default(button)`). |
| `text` | Escribir un texto/código. |
| `math` | Resolver una operación matemática. |
| `custom` | Reto personalizado. |

## Usado por

- [[Modelo CaptchaConfig]] — campo `mode CaptchaMode @default(button)`.
- `CaptchaSession` — campo `mode CaptchaMode` (sin default; refleja el modo activo del reto).

## Comandos

[[Comando /captcha]], `/captcha_mode`, `/captcha_on`, `/captcha_status`. Ver [[Módulo security]].

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo CaptchaConfig]]
- Relacionado con: [[Database Map]], [[Security Map]]
