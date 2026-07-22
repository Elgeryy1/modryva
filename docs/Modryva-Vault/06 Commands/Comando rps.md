---
id: modryva-command-rps
title: Comando rps
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/core-handlers.ts
tags:
  - modryva
  - command
  - community
  - fun
aliases:
  - "/rps"
  - "/dice"
  - "/coin"
  - "/roll"
  - "/8ball"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /rps

## Propósito
Mini-juegos de diversión, deterministas por `updateId` (idempotentes en reintentos). Sin economía ni
persistencia. `/rps` es piedra-papel-tijera con botones.

## Comandos cubiertos
| Comando | `kind` (case) | Salida |
|---|---|---|
| `/rps [elección]` | rps (14621) | PPtijera con teclado inline; resuelve con `playRps`. |
| `/coin` | coin (14604) | Cara o cruz (`coinFlip`). |
| `/roll [NdM]` | roll (14612) | Tiradas clásicas (`rollDice`). |
| `/8ball <pregunta>` | 8ball (14600) | Bola mágica. |
| `/dice` `/dart` `/slots`... | native (14643) | Dado animado nativo de Telegram (`dice`). |

## Sintaxis
`/rps` (o `/rps piedra`) · `/coin` · `/roll 2d6` · `/8ball <pregunta>` · `/dice`. Menú en
`apps/bot/src/core-handlers.ts:158`.

## Permisos
Ninguno. No requiere bot admin.

## Implementación
`handleFunCommand` (`apps/bot/src/bot-update.service.ts:14584`) vía `parseFunCommand`, registrado como
`fun.command` (línea 1577). El callback de RPS lo atiende `handleFunCallback` (14648).
Nota: el `/dice` nativo aquí es de diversión; el casino tiene sus propios `/dado`/`/tragaperras` con apuesta.

## Modelos que toca
Ninguno (resultado calculado en memoria).

## Eventos
Ninguno.

## Errores / edge-cases
Uso incorrecto devuelve el `usage` del parser. Determinismo por `updateId` evita dobles resultados en retry.

## Tests
`modules/games/**` / `modules/fun/**` (funciones puras) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo games]]
- Relacionado con: [[Comando jugar]], [[Comando casino]], [[Comando dado]]
