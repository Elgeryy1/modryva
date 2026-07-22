---
id: modryva-command-help
title: Comando help
type: command
domain: utility
status: implemented
maturity: stable
source:
  - apps/bot/src/core-handlers.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - utility
aliases:
  - "/help"
  - "/start"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /help

## Propósito
Muestra la ayuda del bot: qué puede hacer, cómo configurarlo y (según contexto) el onboarding. `/start` es
el hermano de arranque en privado.

## Sintaxis
`/help` (grupo o privado). En privado suele acompañar al onboarding; en grupo, ayuda contextual.

## Implementación
Handler en `apps/bot/src/core-handlers.ts` / `bot-update.service.ts`. Nota verificada: `core-handlers.ts`
contiene un texto de UI que menciona "11 módulos activos" (discrepa del conteo real de 9 carpetas de
módulo → ver [[Open Questions]] #1).

## Comportamiento
El onboarding distingue si el bot **es admin** o solo miembro (capacidades distintas). En modo silencio
([[Quiet Mode]]) el bot evita mensajes no solicitados.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Core Handlers]], [[Bot Update Service]]
- Relacionado con: [[Comando config]], [[Quiet Mode]], [[Product Map]]
