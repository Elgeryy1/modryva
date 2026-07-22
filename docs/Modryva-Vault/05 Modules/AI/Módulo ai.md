---
id: modryva-module-ai
title: Módulo ai
type: module
domain: ai
status: implemented
maturity: beta
source:
  - modules/ai/src
tags:
  - modryva
  - module
  - ai
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Módulo ai

## Propósito
Funciones de inteligencia artificial del bot: conversación (DM y por mención), memoria, resúmenes y un
proveedor de IA abstraído con modo degradado. Paquete `@superbot/module-ai` (9 ficheros src, 8 tests).

## Ficheros clave (verificado `modules/ai/src`)
- `provider.ts` — abstracción del proveedor (`buildAiProviderFromEnv`); ver [[Integración Proveedor de IA]] (proveedor concreto = `unknown`, [[Open Questions]] #5).
- `degraded-mode.ts` — degradación elegante cuando la IA no está disponible (fallback sin romper).
- `dm-chat.ts` / `mention-chat.ts` — chat por privado y por mención en grupo.
- `memory.ts` — memoria conversacional ([[Modelo AiMemory]]).
- `fight-summary.ts` — resúmenes (p.ej. de conflictos).
- `log-tagger.ts` — etiquetado.
- `commands.ts` — comandos de IA ([[Comando aipack]], `/aistatus`).

## Acceso y cuota
El acceso se controla por códigos/packs (Telegram Stars): [[Modelo AiAccessCode]], [[Modelo AiChatAccess]],
[[Modelo AiUserAccess]], [[Modelo AiSubscription]], [[Modelo AiUsage]]. La conversación persiste en
[[Modelo AiConversation]] / [[Modelo AiMessage]]. Pantalla de config: [[Controller ai-pack]] +
`apps/web/app/config/ai-pack/page.tsx`. **Clave de diseño**: al resumen se le pasan datos agregados, nunca
mensajes crudos innecesarios (ver [[Recap Semanal]]).

## Cableado
`implemented`: chat DM/mención, packs de IA. El proveedor concreto y algunas features auxiliares por confirmar.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Package data]], [[Integración Proveedor de IA]]
- Utilizado por: [[Comando aipack]], [[Recap Semanal]]
- Consume: [[Modelo AiSubscription]], [[Modelo AiUsage]]
- Relacionado con: [[Integración Telegram Stars]], [[Controller ai-pack]]
