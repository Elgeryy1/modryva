---
id: modryva-command-densidad
title: Comando densidad
type: command
domain: utility
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/poller.ts
tags:
  - modryva
  - command
  - utility
  - miniapp
aliases:
  - "/densidad"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /densidad

## Propósito
Ajusta el modo de densidad **por usuario** de la Mini App (filas por pantalla, blur, animaciones, imágenes).
Es una preferencia personal, no una config global del grupo.

## Sintaxis
`/densidad` (ver el modo actual) · `/densidad <modo>` donde `<modo>` ∈ `DENSITY_MODES` (`isDensityMode`).

## Permisos
Ninguno especial: cada usuario ajusta el suyo. Se guarda por `telegramUserId`. No requiere bot admin.

## Implementación
`handleDensityModeCommand` (`apps/bot/src/bot-update.service.ts:12485`), registrado como
`density-mode.command` (línea 1461). Persistencia en `ChatSetting` clave `density_mode` = mapa
`{ userId: modo }`. `resolveDensity(modo)` deriva los ajustes visuales. Descripción en
`apps/bot/src/poller.ts:575`.

## Modelos que toca
[[Modelo ChatSetting]] (clave `density_mode`, por chat, valor por usuario).

## Eventos
`recordAudit` con `density_mode.saved` (12537).

## Errores / edge-cases
"Modo inválido" si no está en `DENSITY_MODES`. Sin `userId` responde "No se pudo identificar al usuario".

## Tests
`modules/community/**` (`resolveDensity`, `isDensityMode`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]]
- Produce: [[Modelo ChatSetting]]
- Relacionado con: [[Comando dock]], [[Comando config]], [[Product Map]]
