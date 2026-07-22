---
id: modryva-ai-seleccion-proveedor
title: Selección de Proveedor de IA
type: feature
domain: ai
status: implemented
maturity: stable
source:
  - modules/ai/src/provider.ts
tags:
  - modryva
  - feature
  - ai
aliases:
  - buildAiProviderFromEnv
  - AiRouter
created: 2026-07-12
updated: 2026-07-12
---

# Selección de Proveedor de IA

## Qué hace
Construye, a partir de la configuración de entorno, un `AiProvider` unificado que la app usa para todas las
llamadas de IA. `buildAiProviderFromEnv(env)` decide qué proveedores están activos (groq / gemini / openrouter),
crea un pool de claves por proveedor y los envuelve en un `AiRouter` con failover y circuit breaker
(`modules/ai/src/provider.ts:585-668`).

Puntos clave:
- **Interruptor global.** Si `AI_ENABLED` es falso, devuelve un router con un único `FakeAiProvider("local")`
  determinista, sin red (`provider.ts:586-588`).
- **Groq** (`AI_GROQ_ENABLED`): modelo por defecto `llama-3.1-8b-instant`; el pool se arma con hasta 5 claves
  numeradas más `AI_GROQ_API_KEYS` (CSV) y se registra como `OpenAiCompatibleProvider` contra
  `https://api.groq.com/openai/v1` (`provider.ts:592-619`).
- **Gemini** (`AI_GEMINI_ENABLED`): hasta 5 claves de proyecto + CSV, modelo por defecto `gemini-2.5-flash-lite`,
  vía `GeminiPoolProvider` (`provider.ts:621-644`).
- **OpenRouter** (`AI_OPENROUTER_ENABLED` + `AI_OPENROUTER_API_KEY`): modelo por defecto `openrouter/free`
  (`provider.ts:646-660`).
- **Guardas de modelo.** `assertGroqModelAllowed` prohíbe cualquier modelo que contenga "70b"
  (`provider.ts:155-161`); `assertOpenRouterModelAllowed` bloquea modelos de pago salvo `openrouter/free` o
  sufijo `:free`, a menos que `AI_OPENROUTER_ALLOW_PAID_MODELS` esté activo (`provider.ts:163-174`).
- **Fallback siempre disponible.** Si no queda ningún proveedor real, el router se construye con
  `FakeAiProvider("local")` (`provider.ts:662-664`).

El `AiRouter` prueba los proveedores en orden según la tarea (`providersForTask`, `provider.ts:564-582`),
salta los que tienen el breaker abierto, cae al siguiente ante error y abre el breaker tras
`failureThreshold` (3) fallos durante `cooldownMs` (30 s) (`provider.ts:485-557`). El pool de claves elige la
clave menos usada del día y aplica cooldown (rate-limit/server) o deshabilita (auth) según el fallo
(`provider.ts:128-153`, `classifyHttpError` en `176-193`).

## Evidencia
- Función principal: `modules/ai/src/provider.ts:585` (`buildAiProviderFromEnv`).
- Router y breaker: `modules/ai/src/provider.ts:485-583`.
- Pool de claves: `modules/ai/src/provider.ts:57-153`.
- Guardas: `modules/ai/src/provider.ts:155-174`.
- Tests: `modules/ai/src/provider.test.ts:77-121` cubre "uses a fake local provider when AI is disabled",
  "blocks Groq 70B", "blocks OpenRouter paid models…" y "allows the free OpenRouter model…";
  `provider.test.ts:45-76` cubre failover, agotamiento y caché del `AiRouter`.
- Defaults de entorno: `packages/shared/src/env.ts:89` (`AI_ENABLED` default false), `:97` (`AI_GROQ_MODEL`),
  `:110` (`AI_GEMINI_MODEL`), `:118-119` (OpenRouter modelo/paid), y validación equivalente de las guardas en
  `packages/shared/src/env.ts:158-172`.

## Estado / cableado
`implemented`. Se instancia una vez por app: `apps/bot/src/app.module.ts:228`
(`useFactory: () => buildAiProviderFromEnv(getRuntimeEnv())`) y `apps/worker/src/server.ts:184`
(`ai: buildAiProviderFromEnv(env)`). El resultado (`this.aiProvider`) lo consumen todos los handlers de chat.

## Preguntas abiertas
- **Qué proveedor(es) están realmente activos en producción es `unknown`**: depende de qué flags/claves
  (`AI_GROQ_ENABLED`, `AI_GEMINI_ENABLED`, `AI_OPENROUTER_ENABLED`) estén puestos en el `.env` del despliegue,
  no verificable desde el código (ver [[Open Questions]] #5). El código solo fija los modelos por defecto y las
  guardas.
- El orden de proveedores por tarea (`providersForTask`) referencia un proveedor llamado `"local"` que solo
  existe como `FakeAiProvider("local")`; no hay proveedor de IA local real cableado.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Integración Proveedor de IA]], [[Cuotas de IA]], [[Modo Degradado de IA]],
  [[Conversación por IA]]
