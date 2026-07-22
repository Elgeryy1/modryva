---
id: modryva-command-start
title: Comando start
type: command
domain: utility
status: implemented
maturity: stable
source:
  - apps/bot/src/core-handlers.ts
tags:
  - modryva
  - command
  - core
  - utility
aliases:
  - "/start"
  - "/menu"
  - "/status"
  - "/cancel"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /start

## Propósito
Pantalla de inicio estilo GroupHelp: bienvenida compacta + teclado inline cuyo primer botón abre el flujo
"añádeme a un grupo como admin". Es el punto de entrada del bot.

## Comandos cubiertos
| Comando | Efecto |
|---|---|
| `/start`, `/menu` | Home + `buildHomeMenu` (botón `startgroup` con permisos admin). |
| `/status` | Sección de estado del bot (envía mensaje nuevo). |
| `/cancel` | "Flujo cancelado." |

`/help` también existe pero tiene nota propia ([[Comando help]]); `/settings` lo maneja `handleSettings`
antes que este dispatcher.

## Sintaxis
`/start`, `/menu`, `/status`, `/cancel` (todos). Los taps de menú (`menu:*`) los atiende `handleCoreCallback`.

## Permisos
Ninguno. Funciona en privado y en grupo.

## Implementación
`handleCoreCommand` (`apps/bot/src/core-handlers.ts:291`, switch en `:302`). El deep-link de alta lleva los
permisos `change_info+delete_messages+restrict_members+invite_users+pin_messages+promote_members`
(`core-handlers.ts:51`).

## Modelos que toca
Ninguno (UI pura).

## Eventos
Ninguno.

## Errores / edge-cases
Ninguno relevante (respuesta estática). El texto de "Estado" menciona "11 modulos activos"
(`core-handlers.ts:213`), que discrepa del conteo real de carpetas de módulo → ver [[Open Questions]].

## Tests
`apps/bot/src/bot-update.service.test.ts` (core commands/menu).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Core Handlers]], [[Bot Update Service]]
- Relacionado con: [[Comando help]], [[Comando config]], [[Product Map]]
