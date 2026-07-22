---
id: modryva-event-chat-member
title: Evento chat_member
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

# Evento chat_member

## Qué es
Cambio de estado de un miembro del chat (entra, sale, es promovido/degradado, baneado). El más referenciado
(35 en `apps/bot/src`). Base de bienvenidas, captcha, antiraid y actualización de membresías.

## Consumidores
[[Bot Update Service]] → [[Welcome]] (nuevos miembros), [[Captcha]], [[Antiraid]] (oleadas de entradas),
actualización de [[Modelo Membership]]. Relacionado: `my_chat_member` para cambios del PROPIO bot
([[Evento my_chat_member]]).

## Persistencia
[[Modelo Membership]], [[Modelo VerifiedUser]] (tras captcha), [[Modelo InviteStat]].

## Relaciones
- Pertenece a: [[Events Map]]
- Consume: [[Modelo Membership]]
- Relacionado con: [[Welcome]], [[Captcha]], [[Antiraid]], [[Evento my_chat_member]]
