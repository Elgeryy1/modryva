---
id: afk
title: AFK
type: feature
domain: community
status: implemented
maturity: stable
source: [modules/community/src/afk.ts, apps/bot/src/bot-update.service.ts, packages/data/prisma/schema.prisma]
tags: [modryva, feature, community]
aliases: [afk, back, unafk, away from keyboard]
created: 2026-07-12
updated: 2026-07-12
---

# AFK

Marca a un usuario como ausente y avisa al grupo cuando alguien lo menciona. Lógica pura en `modules/community/src/afk.ts`; persistencia en [[Modelo AfkStatus]].

## Comandos

Parser `parseAfkCommand` (`afk.ts:31-49`), handler `afk.command` (`apps/bot/src/bot-update.service.ts:1598`):

- `/afk [motivo]` — marca AFK (el motivo es opcional; `afk` sin motivo es válido, sin errores de formato).
- `/back` (alias `/unafk`) — quita el estado AFK.

Confirmaciones: `buildAfkSetReply` (`afk.ts:143-144`) y `buildAfkClearReply` (`afk.ts:151-152`).

## Aviso ambient al mencionar

Handler `afk.ambient` (`bot-update.service.ts:1723`):

- `extractMentions(text)` (`afk.ts:58-75`): extrae `@username` únicos en orden de aparición.
- `findMentionedAfkUsers(text, afkUsers)` (`afk.ts:82-96`): AFK users cuyo username aparece en el texto.
- `buildAfkNotice(user, nowMs)` (`afk.ts:132-137`): p. ej. `"💤 @user está AFK desde hace 2h 3m: motivo"`. La duración se calcula con `formatAfkDuration` (`afk.ts:104-124`) a partir de `nowMs - sinceMs`.

## Persistencia

[[Modelo AfkStatus]] con unique `[tenantId, telegramUserId]` — el AFK es **por tenant, no por chat** (sigue al usuario por todos los grupos del tenant). Índice extra por `[tenantId, username]`.

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo AfkStatus]]
- **Utilizado por**: [[Comando afk]] (`/afk`)
- **Relacionado con**: [[Events Map]], [[Commands Map]]
