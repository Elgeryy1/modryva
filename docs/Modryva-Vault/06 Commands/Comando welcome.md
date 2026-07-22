---
id: modryva-command-welcome
title: Comando welcome
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - modules/community/src/welcome.ts
tags:
  - modryva
  - command
  - community
  - config
aliases:
  - "/welcome"
  - "/setwelcome"
  - "/resetwelcome"
  - "/setgoodbye"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /welcome

## Propósito
Gestiona el mensaje de **bienvenida** (y despedida) del grupo. La bienvenida se envía automáticamente cuando
entra un nuevo miembro (si está configurada). Soporta variables `{first_name}`, `{username}`, `{chat_title}`.

## Comandos cubiertos
| Comando | `kind` | Efecto |
|---|---|---|
| `/welcome` | show-welcome | Muestra la bienvenida actual. |
| `/setwelcome <texto>` | set-welcome | Define la bienvenida. |
| `/resetwelcome` | reset-welcome | Desactiva la bienvenida. |
| `/setgoodbye <texto>` | set-goodbye | Define la despedida. |

Nombres nativos en `modules/community/src/welcome.ts:20-25`. (Las **reglas** — `/rules`/`/setrules` — comparten
handler pero tienen nota propia: [[Comando reglas]].)

## Sintaxis
Ver tabla. `/setwelcome` y `/setgoodbye` requieren texto.

## Permisos
Ver es abierto. Definir/`reset` requieren `welcome.config` (`ensureConfigPermission`,
`bot-update.service.ts:13739`) — admins. No requiere bot admin de Telegram para configurar (sí para no
chocar con permisos al saludar).

## Implementación
`handleWelcomeCommand` (`apps/bot/src/bot-update.service.ts:13697`) vía `parseWelcomeCommand`. La bienvenida
automática se dispara en `handleNewMembers` (14122).

## Modelos que toca
[[Modelo WelcomeConfig]] (`welcomeText`, `goodbyeText`, `rulesText`).

## Eventos
`recordAudit` `welcome.config.updated` (13769).

## Errores / edge-cases
"No hay mensaje de bienvenida configurado. Usa /setwelcome..." si está vacío. Fuera de grupo pide grupo.

## Tests
`modules/community/src/welcome.ts` (parser) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Produce: [[Modelo WelcomeConfig]]
- Relacionado con: [[Comando reglas]], [[Comando config]]
