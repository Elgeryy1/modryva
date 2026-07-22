---
id: modryva-command-dkick
title: Comando dkick
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
  - "/dkick"
  - "/dmute"
  - "/dban"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /dkick

## Propósito
Moderación con **borrado** ("d" = delete): aplica la sanción **y borra el mensaje respondido** del infractor.
Variantes: `/dkick` (expulsar), `/dmute` (silenciar), `/dban` (banear).

## Sintaxis
Responde al mensaje ofensivo con `/dkick` / `/dmute` / `/dban`. Familia en
`modules/security/src/moderation-plus.ts:57,144-151` (`dmute`→mute, `dkick`→kick, resto→ban).

## Permisos
Requiere admin (`isActorAdmin`, `bot-update.service.ts:2312`). **Requiere que el bot sea admin** de Telegram
para borrar el mensaje y expulsar/restringir.

## Implementación
`handleModerationPlusCommand` (`apps/bot/src/bot-update.service.ts:2296`). En `kind === "delete"` extrae el
`messageId` respondido (`extractReplyContext`) y lo borra (2362), luego aplica la acción por Gateway. A
diferencia de `/skick`, sí devuelve un reply visible con el verbo ("👢 Expulsado", "🔨 Baneado"...).

## Modelos que toca
[[Modelo Sanction]] (salvo kick), [[Modelo AuditLog]]; emite ruta `moderation_actions`.

## Eventos
`recordAudit` `moderation.delete.<action>` (2381); `emitOwnerNetworkRoute` (2387); `recordRiskSignal`.

## Errores / edge-cases
Si Telegram rechaza la sanción devuelve "⚠️ Registrado, pero Telegram rechazó..." (2408) — el usuario no
está en el grupo o faltan permisos. El borrado del mensaje es best-effort (try/catch).

## Tests
`modules/security/src/moderation-plus.test.ts` + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo security]], [[Package telegram]]
- Produce: [[Modelo Sanction]], [[Modelo AuditLog]]
- Relacionado con: [[Comando skick]], [[Comando ban]], [[Security Map]]
