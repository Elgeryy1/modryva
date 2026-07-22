---
id: modryva-command-config
title: Comando config
type: command
domain: admin
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - docs/COMMANDS.md
tags:
  - modryva
  - command
  - admin
aliases:
  - "/config"
  - "/settings"
  - Comando settings
created: 2026-07-12
updated: 2026-07-12
---

# Comando /config

## Propósito
Abre la configuración del grupo. Doble superficie: **inline** en el chat (`/settings`) y la **Mini App**
`/config` (28 pantallas web). Ver [[Product Map]] y [[API Map]].

## Sintaxis
`/config` / `/settings` (en grupo, por admins). Abre botones inline o deep-link a la Mini App de configuración.

## Permisos
Admin del grupo. La configuración se persiste en [[Modelo ChatSetting]] (patrón clave-valor por chat) y
tablas de config específicas ([[Modelo WelcomeConfig]], [[Modelo AntifloodConfig]], etc.).

## Implementación
Handler en `apps/bot/src/bot-update.service.ts`. La Mini App consume los controllers
`v1/miniapp/config` ([[Controller config]]) y otros. Secciones web: moderation, automations, blocklist,
filters, gamification, quiet, recap, wizard, etc. ([[Product Map]]).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Controller config]]
- Produce: [[Modelo ChatSetting]]
- Relacionado con: [[Product Map]], [[API Map]], [[Quiet Mode]]
