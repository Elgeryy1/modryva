---
id: modryva-command-id
title: Comando id
type: command
domain: utility
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/core-handlers.ts
tags:
  - modryva
  - command
  - utility
aliases:
  - "/id"
  - "/calc"
  - "/pick"
  - "/hash"
  - "/b64"
  - "/password"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /id

## Propósito
Utilidades de texto/datos sin estado. `/id` devuelve tu ID, el del chat y el del mensaje — útil para
configurar rutas, whitelists o dar soporte.

## Comandos cubiertos
| Comando | `kind` (case) | Salida |
|---|---|---|
| `/id` | id (14707) | ID de usuario, chat y mensaje. |
| `/calc <expr>` | calc (14689) | Calculadora segura (`evaluateExpression`). |
| `/pick a\|b\|c` | pick (14719) | Elección al azar. |
| `/hash <texto>` | hash (14729) | sha256. |
| `/b64` `/unb64` | b64 (14723) | Base64. |
| `/password [n]` | password (14742) | Contraseña aleatoria. |
| `/reverse` `/len` `/upper` `/lower` | — | Trucos de texto. |

## Sintaxis
Ver tabla. Menú en `apps/bot/src/core-handlers.ts:171`.

## Permisos
Ninguno. No requiere bot admin.

## Implementación
`handleUtilityCommand` (`apps/bot/src/bot-update.service.ts:14673`) vía `parseUtilityCommand`, registrado
como `utility.command` (línea 1585). Todo se calcula en memoria.

## Modelos que toca
Ninguno.

## Eventos
Ninguno.

## Errores / edge-cases
`/calc` rechaza división por cero y expresiones inválidas; `/unb64` valida base64.

## Tests
`modules/**` (funciones puras: `evaluateExpression`, `sha256Hex`, `generatePassword`) +
`apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]]
- Relacionado con: [[Comando q]], [[Comando config]]
