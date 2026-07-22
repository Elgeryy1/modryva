---
id: modryva-command-skick
title: Comando skick
type: command
domain: moderation
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - modules/security/src/moderation-plus.ts
tags:
  - modryva
  - command
  - moderation
aliases:
  - "/skick"
  - "/smute"
  - "/sban"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /skick

## Propósito
Moderación **silenciosa** ("s" = silent): aplica la sanción y **borra el mensaje del propio comando**, sin
dejar respuesta visible en el chat. Variantes: `/skick` (expulsar), `/smute` (silenciar, con duración),
`/sban` (banear).

## Sintaxis
`/skick` (responde al usuario o `/skick <id> [motivo]`) · `/smute <duración> ...` · `/sban ...`. Familia
definida en `modules/security/src/moderation-plus.ts:54,108-135`.

## Permisos
Requiere admin: `isActorAdmin` (`bot-update.service.ts:2312`) — "No tienes permisos para moderar".
**Requiere que el bot sea admin** de Telegram para expulsar/restringir (enforcement por Gateway).

## Implementación
`handleModerationPlusCommand` (`apps/bot/src/bot-update.service.ts:2296`) vía `parseModerationPlusCommand`
(usa `withReplyTarget`). Un `kick` no deja `Sanction` persistente; `mute`/`ban` sí. En modo `silent` borra
el comando (2351) y **no devuelve reply** (`return null`, 2402).

## Modelos que toca
[[Modelo Sanction]] (salvo kick), [[Modelo ModerationCase]] indirecto, [[Modelo AuditLog]]. Emite ruta de
red de dueño (`moderation_actions`).

## Eventos
`recordAudit` `moderation.silent.<action>` (2381); `emitOwnerNetworkRoute` (2387); `recordRiskSignal`.

## Errores / edge-cases
Silencioso incluso en fallo (no responde). Para acciones con reply visible, ver `/ban` clásico.

## Tests
`modules/security/src/moderation-plus.test.ts` + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo security]], [[Package telegram]]
- Produce: [[Modelo Sanction]], [[Modelo AuditLog]]
- Relacionado con: [[Comando dkick]], [[Comando ban]], [[Security Map]]
