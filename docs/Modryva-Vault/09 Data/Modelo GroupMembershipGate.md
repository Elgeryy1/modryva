---
id: modryva-model-groupmembershipgate
title: Modelo GroupMembershipGate
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/group-protection-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo GroupMembershipGate

## Propósito
Puerta de membresía: exige pertenecer a otro chat (`requiredTelegramChatId`) para escribir en el chat
protegido. Guarda el id de Telegram del chat protegido para poder resolver desde un `chat_member`
update sin otro repositorio. Tabla `group_membership_gates`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `telegramChatId` | BigInt | Chat protegido (id Telegram). |
| `requiredTelegramChatId` | BigInt | Chat obligatorio. |

## Índices / restricciones
`@@unique([chatId, requiredTelegramChatId])`; `@@index([tenantId])`, `@@index([chatId])`,
`@@index([requiredTelegramChatId])`.

## Enums usados
Ninguno.

## Acceso
`group-protection-repository.ts` (crear/quitar gate; comprobar membresía requerida).

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: filtro de entrada/mensajes
- Relacionado con: [[Modelo VerifiedUser]], [[Modelo Chat]], [[Database Map]]
