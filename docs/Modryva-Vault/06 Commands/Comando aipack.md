---
id: modryva-command-aipack
title: Comando aipack
type: command
domain: ai
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - docs/COMMANDS.md
tags:
  - modryva
  - command
  - ai
aliases:
  - "/aipack"
  - "/aistatus"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /aipack

## Propósito
Gestiona el acceso a las funciones de IA: el "Pack de IA" (suscripción por Telegram Stars, cuota mensual) y
los códigos/acceso a IA por cuota. `/aistatus` consulta el estado de acceso/uso.

## Sintaxis
`/aipack` (ver/activar pack), `/aistatus` (estado). Detalles en `docs/COMMANDS.md` (secciones "Acceso a IA
por código" y "Pack de IA").

## Permisos / acceso
El acceso a IA se controla por cuota y suscripción: [[Modelo AiAccessCode]], [[Modelo AiChatAccess]],
[[Modelo AiUserAccess]], [[Modelo AiSubscription]], [[Modelo AiUsage]]. Nota de producto: el acceso a IA
redimido en un DM sigue al usuario en todos lados (fix conocido).

## Implementación
Handler en `apps/bot/src/bot-update.service.ts`; la Mini App usa [[Controller ai-pack]]
(`v1/miniapp/ai-pack`) y la pantalla `apps/web/app/config/ai-pack/page.tsx`. Lógica en [[Módulo ai]].

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo ai]], [[Controller ai-pack]]
- Consume: [[Modelo AiSubscription]], [[Modelo AiUsage]]
- Relacionado con: [[Integración Telegram Stars]], [[Chip Economy]]
