---
id: custom-commands
title: Custom Commands
type: feature
domain: community
status: implemented
maturity: stable
source: [modules/community/src/custom-commands.ts, apps/bot/src/bot-update.service.ts, packages/data/prisma/schema.prisma]
tags: [modryva, feature, community]
aliases: [comandos personalizados, addcmd, delcmd, cmds]
created: 2026-07-12
updated: 2026-07-12
---

# Custom Commands

Comandos `/` personalizados por grupo: nombre → respuesta fija. Parser puro en `modules/community/src/custom-commands.ts`; persistencia en [[Modelo CustomCommand]].

## Comandos de gestión

Parser `parseCustomCommandConfig` (`custom-commands.ts:54-93`), handler `custom-command.config` (`apps/bot/src/bot-update.service.ts:1416`):

- `/addcmd <nombre> <respuesta>` — crea (upsert con `customCommandRepository.upsert`, `bot-update.service.ts:11841`).
- `/delcmd <nombre>` — borra (`customCommandRepository.remove`, `bot-update.service.ts:11821`).
- `/cmds` — lista los comandos del chat (`customCommandRepository.list`, `bot-update.service.ts:11799`).

## Reglas de nombre

- Normalización: trim, quita un `/` inicial y baja a minúsculas (`normalizeCustomName`, `custom-commands.ts:44-45`).
- Patrón válido: `^[a-z0-9_]{1,32}$` (`custom-commands.ts:35`).
- **No puede pisar built-ins**: `isReservedCommand` rechaza `start, help, menu, settings, status, cancel, addcmd, delcmd, cmds` (`custom-commands.ts:23-33,51-52`).

## Dispatch

Cuando llega un `/comando` que coincide con uno guardado, el handler `custom-command.dispatch` (`bot-update.service.ts:1731`) responde con el texto almacenado (`customCommandRepository.get`, `bot-update.service.ts:11870`).

## Persistencia

[[Modelo CustomCommand]] con unique `[chatId, name]` (un comando por nombre y chat).

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo CustomCommand]]
- **Utilizado por**: [[Comando addcmd]] (`/addcmd`)
- **Relacionado con**: [[Filters]], [[Commands Map]]
