---
id: modryva-roadmap-bot-factory
title: Roadmap Bot Factory self-serve
type: roadmap
domain: roadmap
status: planned
maturity: unknown
source:
  - packages/data/src/platform-repository.ts
tags:
  - modryva
  - roadmap
  - platform
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Roadmap — Bot Factory self-serve

## Estado
**planned.** La base multi-bot existe ([[ADR-007 Plataforma multi-bot con tokens cifrados]]): el bot padre ya
crea/gestiona bots hijos ([[Managed Bots]], [[Modelo ManagedBot]]). Falta el **self-serve completo**: que un
usuario dé de alta su propio bot hijo de principio a fin sin intervención manual.

## Idea
Flujo autoservicio: el usuario pega el token de su bot (de `@BotFather`), la plataforma lo cifra
([[Env MANAGED_BOT_TOKEN_KEY]]), configura webhook/scoping ([[Bot Scoping]], [[Webhook de Bots Hijos]]) y le
entrega un panel "Mis bots" para gestionarlos.

## Pendiente conocido
- Pantalla "Mis bots" (gestión de bots hijos del usuario).
- Reactivar/pausar un bot hijo; backoff ante 429.
- Escopar el resto de usos de `TELEGRAM_BOT_USERNAME` a bot hijo.
- Endurecer seguridad del alta (validación de token, límites por usuario).

## Preguntas abiertas
- Modelo de monetización/límites del self-serve: `unknown` (ligado a precios — ver [[Roadmap Rediseño Total]]).

## Relaciones
- Pertenece a: [[Roadmap Map]]
- Depende de: [[Modryva Hub Map]], [[Managed Bots]]
- Relacionado con: [[ADR-007 Plataforma multi-bot con tokens cifrados]], [[Riesgo Tokens de bots hijos cifrados]]
