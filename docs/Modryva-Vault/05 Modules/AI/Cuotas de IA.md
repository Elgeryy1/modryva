---
id: modryva-ai-cuotas
title: Cuotas de IA
type: feature
domain: ai
status: implemented
maturity: stable
source:
  - modules/ai/src/provider.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - ai
aliases:
  - estimateTokens
  - AI_TOKEN_BUDGET
created: 2026-07-12
updated: 2026-07-12
---

# Cuotas de IA

## Qué hace
Limita el consumo de IA en tres niveles complementarios:

1. **Presupuesto de tokens por chat.** Antes de llamar al proveedor, cada superficie comprueba
   `usageTokens(tenantId, chatId)` contra `AI_TOKEN_BUDGET = 2_000_000`; si se supera, responde
   "Se ha agotado el presupuesto de IA de este chat" y no llama al modelo
   (`apps/bot/src/bot-update.service.ts:5047-5054`, DM `:17755-17765`, mención `:17885-17892`).
2. **Límites por petición.** `maxTokens = Math.min(AI_MAX_TOKENS_PER_REQUEST, 512)` en cada `complete(...)`
   (`bot-update.service.ts:5134`) y `AI_MAX_INPUT_CHARS` recorta la entrada vía `sanitizeAiInput`.
3. **Contabilidad por clave.** El pool reparte carga eligiendo la clave menos usada del día y acumula
   `usedRequestsToday` / `usedTokensToday` por clave (`modules/ai/src/provider.ts:128-142`).

El conteo de tokens usa `estimateTokens(text) = max(1, ceil(len/4))` como estimación (~4 chars/token) cuando el
proveedor no devuelve `usage` real (`modules/ai/src/provider.ts:51-53`, usado en `:295-301` y `:402-409`). Cada
turno se persiste con `tokensIn`/`tokensOut` vía `recordTurn(...)` (`bot-update.service.ts:5149-5158`), que es
lo que alimenta `usageTokens`.

## Evidencia
- `modules/ai/src/provider.ts:51-53` (`estimateTokens`), `:138-142` (contadores por clave).
- Presupuesto e integración: `apps/bot/src/bot-update.service.ts:5047-5054`, `:5133-5158`.
- Defaults de entorno: `packages/shared/src/env.ts:135` (`AI_MAX_TOKENS_PER_REQUEST` default 1200),
  `:136` (`AI_MAX_INPUT_CHARS` default 8000), `:137` (`AI_CACHE_TTL_SECONDS` default 3600).
- La caché de completados por tarea (`translate`, `summarize_short`, `moderation_hint`, `ticket_triage`) evita
  llamadas repetidas: `modules/ai/src/provider.ts:195-229` y TTL en el router `:662-667`.
- Test de token accounting: `modules/ai/src/provider.test.ts:38-43` ("estimateTokens scales with length…").

## Estado / cableado
`implemented`. El presupuesto de 2M tokens/chat es una constante inline en el handler (no configurable por
entorno). El uso persistido corresponde al modelo [[Modelo AiUsage]] (a través del repositorio de IA); la
auditoría de cada completado registra `tokensIn`/`tokensOut` (`bot-update.service.ts:5163-5176`).

## Preguntas abiertas
- `AI_TOKEN_BUDGET` está hardcodeado a 2.000.000 en varios sitios; no hay override por entorno ni por
  plan/tenant en el código (política de reset del presupuesto = `unknown` desde el módulo).
- Los contadores `usedTokensToday`/`usedRequestsToday` del pool viven en memoria del proceso; su reinicio
  diario no se observa en `provider.ts` (no hay cron de reset en este fichero).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Selección de Proveedor de IA]], [[Códigos de Acceso IA]], [[Modelo AiUsage]],
  [[Modo Degradado de IA]]
