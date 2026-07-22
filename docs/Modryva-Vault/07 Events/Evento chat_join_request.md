---
id: modryva-event-chat-join-request
title: Evento chat_join_request
type: event
domain: event
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - event
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Evento chat_join_request

## Qué es
Solicitud de un usuario para unirse a un grupo/canal con aprobación (8 referencias en `apps/bot/src`). Punto
de enganche de captcha/verificación previa a la entrada y de antiraid.

## Consumidores
[[Bot Update Service]] → [[Captcha]] / verificación ([[Modelo VerifiedUser]]), [[Antiraid]] (filtra oleadas),
[[Modelo GroupMembershipGate]].

## Relaciones
- Pertenece a: [[Events Map]]
- Consume: [[Modelo VerifiedUser]]
- Relacionado con: [[Captcha]], [[Antiraid]], [[Evento chat_member]]
