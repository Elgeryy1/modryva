---
id: modryva-command-ban
title: Comando ban
type: command
domain: moderation
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - docs/COMMANDS.md
tags:
  - modryva
  - command
  - moderation
aliases:
  - "/ban"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /ban

## Propósito
Banear (expulsar y bloquear reingreso) a un usuario del grupo. Comando de moderación clásico.

## Sintaxis
`/ban` respondiendo a un mensaje, o `/ban @usuario [motivo]` (confirmar forma exacta en el dispatch).
Alias/relacionados detectados: `/skick`, `/dkick` (kicks), ver `docs/COMMANDS.md` sección Moderación.

## Permisos
Requiere rol de moderación/admin (RBAC → [[Modelo Role]], [[Modelo Permission]]). **Requiere que el bot sea
admin** con permiso de baneo en Telegram; si no lo es, aplica el patrón "ver ≠ actuar" / aviso honesto
(ver [[Flujo Ban]]).

## Implementación
Handler en `apps/bot/src/bot-update.service.ts` (buscar `handleBan*`/literal `"/ban"`). Ejecuta la acción
vía [[Package telegram]] (gateway → `banChatMember`).

## Efectos
Persiste una [[Modelo Sanction]] (kind ban) y un [[Modelo ModerationCase]]; escribe [[Modelo AuditLog]].
Puede generar [[Modelo Appeal]] si el usuario apela por privado.

## Errores / edge-cases
Bot no admin, jerarquía (no se puede banear a otro admin), usuario ya fuera. Ver [[Flujo Ban]].

## Tests
`modules/security/**` (lógica de sanción). Confirmar test específico del handler.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Package telegram]]
- Produce: [[Modelo Sanction]], [[Modelo ModerationCase]], [[Modelo AuditLog]]
- Relacionado con: [[Flujo Ban]], [[Comando mute]], [[Security Map]]
