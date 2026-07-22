---
id: modryva-command-dock
title: Comando dock
type: command
domain: admin
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/poller.ts
tags:
  - modryva
  - command
  - admin
  - miniapp
aliases:
  - "/dock"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /dock

## Propósito
Configura los accesos rápidos ("dock") del panel/Mini App del grupo: listar el orden actual, fijar/quitar
un acceso favorito o restablecer al orden por defecto.

## Sintaxis
`/dock` o `/dock list` (ver) · `/dock toggle <acceso>` · `/dock reset`. El `<acceso>` debe estar en
`DEFAULT_DOCK`.

## Permisos
`list` es abierto. `toggle`/`reset` requieren `dock.config` (`ensureConfigPermission`,
`bot-update.service.ts:12429`) — admins del grupo. No requiere que el bot sea admin de Telegram.

## Implementación
`handleDockCommand` (`apps/bot/src/bot-update.service.ts:12396`), registrado como `dock.config` en
`botHandlers()` (línea 1456). El estado se guarda en `ChatSetting` clave `dock_order` (array de ids);
`resolveDock` + `toggleFavorite` calculan el orden. Descripción en `apps/bot/src/poller.ts:571`.

## Modelos que toca
[[Modelo ChatSetting]] (clave `dock_order`).

## Eventos
`recordAudit` con `dock.reset` (12448) y `dock.toggled` (12474).

## Errores / edge-cases
"Acceso desconocido" si el id no está en `DEFAULT_DOCK`. Fuera de un grupo responde pidiendo usarlo en grupo.

## Tests
`modules/community/**` (`resolveDock`, `toggleFavorite`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]]
- Produce: [[Modelo ChatSetting]]
- Relacionado con: [[Comando config]], [[Comando densidad]], [[Product Map]]
