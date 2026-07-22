---
id: package-domain
title: Package domain
type: architecture
domain: architecture
status: implemented
maturity: stable
source:
  - packages/domain/src/index.ts
  - packages/domain/src/update.ts
  - packages/domain/src/reply.ts
  - packages/domain/src/module.ts
tags:
  - modryva
  - architecture
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Package domain

`@superbot/domain` son los **contratos puros de dominio**: tipos e interfaces sin dependencias de runtime.
Es la base sobre la que hablan todas las capas — el "lenguaje común" del bot.

## Qué exporta

`packages/domain/src/index.ts` reexporta:

- `update.ts` — **`TelegramUpdateEnvelope`**, el envelope normalizado que recorre toda la pipeline
  ([[Bot Pipeline]]), más `TelegramUpdateKind` (`message`, `callback_query`, `inline_query`,
  `guest_message`, `managed_bot`, `my_chat_member`, `chat_member`, `message_reaction`…) y los sub-contextos
  (`ChatContext`, `UserContext`, `NormalizedCommand`, `MessageContentFlags`, `MessageAttachment`,
  `PreCheckoutContext`, `SuccessfulPaymentContext`, `BotMembershipContext`, `ReactionContext`…).
- `reply.ts` — **`BotReply`**: la forma de una respuesta del bot (`text`, `parseMode`, `replyMarkup`,
  `dice`, `edit`). Es lo que devuelve cada handler y consume [[Delivery]].
- `module.ts` — contrato de módulo: `ModuleManifest`, `ModuleCommand`, `ModuleJob`, `LoadedModule`
  (nombre, versión, permisos, comandos, jobs, feature flag).
- `permissions.ts`, `registry.ts` — claves de permiso y registro de módulos.

## Quién lo usa

Prácticamente todo el código de dominio: [[Bot Update Service]] y los handlers construyen y devuelven
`BotReply`; [[Package telegram]] produce `TelegramUpdateEnvelope` con `normalizeUpdate`; los `modules/*`
importan `ActorRole`/`BotReply`/`TelegramUpdateEnvelope`; la [[App api]] y [[App worker]] usan los mismos
tipos de dominio.

## Relaciones

- Pertenece a: [[Architecture Map]]
- Utilizado por: [[App bot]], [[App api]], [[App worker]], [[Package telegram]], [[Package data]], [[Modules Map]]
- Relacionado con: [[Arquitectura General]], [[Update Lifecycle]], [[Delivery]]
