---
id: modryva-command-afk
title: Comando afk
type: command
domain: utility
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - utility
  - productivity
aliases:
  - "/afk"
  - "/back"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /afk

## Propósito
Marca al usuario como ausente (AFK). Cuando alguien lo mencione o le responda, el bot avisa que está AFK;
el propio usuario "vuelve" automáticamente al escribir.

## Sintaxis
`/afk [motivo]` para marcarse ausente · `/back` (o escribir cualquier mensaje) para volver.

## Permisos
Ninguno especial (cada usuario gestiona el suyo). No requiere bot admin.

## Implementación
`handleAfkCommand` (`apps/bot/src/bot-update.service.ts:17550`) vía `parseAfkCommand`, registrado como
`afk.command` (línea 1598). `kind === "set"` guarda con `productivityRepository.setAfk`; el resto limpia con
`clearAfk`. El comportamiento ambiental (aviso + retorno automático) está en `handleAfkAmbient` (17594).

## Modelos que toca
[[Modelo AfkStatus]] (`ProductivityRepository`).

## Eventos
No emite `recordAudit` (usa `setAfk`/`clearAfk` directamente).

## Errores / edge-cases
"No estabas AFK" si `/back` sin estar ausente. "No pude identificarte" sin `userId`.

## Tests
`apps/bot/src/bot-update.service.test.ts` + `modules/**` (`buildAfkSetReply`, `buildAfkClearReply`).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]]
- Produce: [[Modelo AfkStatus]]
- Relacionado con: [[Comando recordar]]
