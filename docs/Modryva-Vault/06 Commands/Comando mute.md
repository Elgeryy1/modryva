---
id: modryva-command-mute
title: Comando mute
type: command
domain: security
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - security
aliases:
  - "/mute"
  - "/unmute"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /mute

## Qué hace
Silencia a un usuario en el grupo: le retira el permiso de enviar mensajes, opcionalmente por un tiempo. Su
inverso es `/unmute`.

## Sintaxis (según tests)
`/mute <usuario> [duración] [motivo]` — ej. `/mute 99 10m flood` (`bot-update.service.test.ts:2648`,
`:3808`). El usuario se indica por reply, mención o id; la duración admite formatos tipo `10m`.

## Evidencia
- Handler de acción de sanción: `apps/bot/src/bot-update.service.ts:6005` (`case "mute"`), plan de acción
  `mute` en `:3047` y `:3163`.
- Aplicación en Telegram vía `restrictChatMember` ([[Integración Telegram Bot API]]).
- Inverso `unmute`: `bot-update.service.ts:3123`, `:3159`; mencionado también al aceptar una apelación
  (`:6435` "Revisa si procede /unban o /unmute").

## Precondiciones
Bot **admin** con permiso de restringir miembros; emisor admin. Sin permiso → modo *companion* (avisa, no
finge) — ver [[Módulo security]].

## Detalle importante
Un usuario muteado **no puede escribir** → un captcha por texto sería irresoluble para él; usar captcha por
botón. Ver [[Flujo Mute]] y [[Captcha]].

## Estado
Implementado y con cobertura de tests en `bot-update.service.test.ts` (múltiples casos de acción `mute`).

## Relaciones
- Pertenece a: [[Commands Map]]
- Implementado por: [[Flujo Mute]]
- Depende de: [[Módulo security]], [[Integración Telegram Bot API]]
- Relacionado con: [[Comando ban]], [[Flujo Warn]], [[Modelo Sanction]]
