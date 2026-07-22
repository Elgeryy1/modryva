---
id: modryva-command-pin
title: Comando pin
type: command
domain: admin
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/core-handlers.ts
tags:
  - modryva
  - command
  - admin
aliases:
  - "/pin"
  - "/unpin"
  - "/del"
  - "/settitle"
  - "/setdesc"
  - "/promote"
  - "/demote"
  - "/invitelink"
  - "/admins"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /pin

## Propósito
Herramientas de administración que actúan directamente sobre Telegram (fijar mensajes, editar título/descripción,
promover/degradar admins, generar enlaces, listar admins). Todas comparten un único handler.

## Comandos cubiertos
| Comando | `kind` (case) | Acción Gateway |
|---|---|---|
| `/pin` | pin (14455) | `pinChatMessage` |
| `/unpin` | unpin (14466) | `unpinChatMessage` |
| `/del` | del (14476) | `deleteMessage` (+ borra el propio `/del`) |
| `/settitle <texto>` | settitle (14501) | `setChatTitle` |
| `/setdesc <texto>` | setdesc (14512) | `setChatDescription` |
| `/promote [titulo]` | promote (14523) | `promoteChatMember` |
| `/demote` | demote (14535) | `demoteChatMember` |
| `/invitelink` | invitelink (14546) | `createChatInviteLink` |
| `/admins` | admins (14556) | `getChatAdministrators` → `formatAdminList` |

## Sintaxis
La mayoría responden a un mensaje o toman argumentos (título, id de usuario). Ver menú admin en
`apps/bot/src/core-handlers.ts:144`.

## Permisos
Requiere `moderation.write` vía `evaluatePolicy` (`bot-update.service.ts:14426`): solo admins.
**Requiere que el bot sea admin de Telegram** con los permisos correspondientes; si Telegram rechaza,
responde "Telegram rechazó la operación. Comprueba que soy admin..." (14566).

## Implementación
`handleAdminToolCommand` (`apps/bot/src/bot-update.service.ts:14410`) vía `parseAdminToolCommand`,
registrado como `admin-tool.command` (línea 1542). Ejecuta por [[Package telegram]] (gateway).

## Modelos que toca
No persiste dominio propio; escribe [[Modelo AuditLog]].

## Eventos
`recordAudit` con `admin.<kind>` (14574) tras cada operación.

## Errores / edge-cases
Fuera de grupo: "Este comando se usa dentro de un grupo". Bot sin permisos: mensaje de rechazo del Gateway.

## Tests
`apps/bot/src/bot-update.service.test.ts` (dispatch de admin tools).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Package telegram]]
- Produce: [[Modelo AuditLog]]
- Relacionado con: [[Comando ban]], [[Comando config]], [[Security Map]]
