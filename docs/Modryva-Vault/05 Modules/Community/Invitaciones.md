---
id: modryva-community-invitaciones
title: Invitaciones
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/invites.ts
tags:
  - modryva
  - feature
  - community
aliases: [invites, inviters, invitaciones, ranking de invitaciones]
created: 2026-07-12
updated: 2026-07-12
---

# Invitaciones

## Qué hace
Cuenta cuántos miembros ha traído cada persona y expone `/invites` (las tuyas) y `/inviters` (ranking del grupo). La lógica pura excluye auto-altas: un usuario que se une por su cuenta no cuenta como invitación.

## Evidencia
- `parseInviteCommand` reconoce `invites`/`inviters` y mapea a `self`/`top` (`modules/community/src/invites.ts:12-30`).
- `countInvitedMembers(inviterId, newMemberIds)` filtra al propio invitador de la lista de nuevos (`invites.ts:37-46`).
- Test: `modules/community/src/invites.test.ts`.

## Estado / cableado
Implemented. Handler en `apps/bot/src/bot-update.service.ts:7852` (`parseInviteCommand`). `countInvitedMembers` se aplica al procesar altas de miembros para acreditar al invitador. Imports en `bot-update.service.ts:162,240`.

## Preguntas abiertas
- Modelo Prisma donde se acumulan los conteos por invitador y cómo se determina el `inviterId` (Telegram no siempre lo entrega) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Welcome]], [[Comando invites]]
