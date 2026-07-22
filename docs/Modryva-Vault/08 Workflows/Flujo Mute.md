---
id: modryva-flujo-mute
title: Flujo Mute
type: flow
domain: security
status: implemented
maturity: stable
source:
  - modules/security
tags:
  - modryva
  - flow
  - security
aliases:
  - Flujo de silenciar
created: 2026-07-12
updated: 2026-07-12
---

# Flujo — silenciar (mute) a un usuario

## Disparador
Un admin ejecuta [[Comando mute]] (o el bot aplica un mute automático por regla de moderación /
[[Flujo Warn|escalado de warns]]).

## Precondiciones
- Bot **admin** con permiso de restringir miembros. Sin permiso → modo *companion* (avisa, no finge) — ver
  [[Módulo security]].

## Pasos
1. **Autorización** del emisor y resolución del objetivo (reply/mención/id).
2. **Restricción en Telegram**: `restrictChatMember` quitando permiso de enviar mensajes (con o sin
   caducidad según el comando) → [[Integración Telegram Bot API]].
3. **Persistencia**: se registra la sanción/tiempo ([[Package data]]); queda en `activity-log`.
4. **Feedback honesto**: confirma el resultado real (o el error exacto de Telegram).

## Detalle relevante (captcha vs. mute)
Un usuario **muteado no puede escribir**; por eso un captcha que exija *responder escribiendo* a un usuario
muteado es imposible de resolver (bug histórico ya corregido). El mute como gate debe combinarse con un
captcha por **botón/callback**, no por texto. Ver [[Captcha]].

## Ramas y fallos
- **Objetivo admin** → rechazo.
- **Mute temporal** → expira solo; si hay job de expiración, lo levanta ([[Job expiration]]).
- **Modo silencio** → se minimizan mensajes no pedidos.

## Estado observable
`activity-log` (mute/unmute, duración); restricción visible en el estado del miembro.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Implementa: [[Comando mute]]
- Depende de: [[Módulo security]], [[Integración Telegram Bot API]]
- Relacionado con: [[Flujo Warn]], [[Flujo Ban]], [[Captcha]], [[Job expiration]]
