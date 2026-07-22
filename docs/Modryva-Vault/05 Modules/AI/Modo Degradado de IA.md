---
id: modryva-ai-modo-degradado
title: Modo Degradado de IA
type: feature
domain: ai
status: partial
maturity: experimental
source:
  - modules/ai/src/degraded-mode.ts
  - modules/ai/src/provider.ts
tags:
  - modryva
  - feature
  - ai
aliases:
  - decideDegradedMode
  - formatDegradedNotice
created: 2026-07-12
updated: 2026-07-12
---

# Modo Degradado de IA

## Qué hace
Define una política pura a nivel de grupo para pausar la IA cuando falla repetidamente o se agota el
presupuesto, y un aviso suave para el chat.

- **`decideDegradedMode(state, nowMs, opts?)`** (`modules/ai/src/degraded-mode.ts:79-129`) decide en orden de
  prioridad: (1) `budgetExceeded` degrada de inmediato sin reintento (`retryAtMs: null`); (2) alcanzar
  `failureThreshold` (default 3, `:38`) fallos consecutivos degrada y programa el reintento en
  `lastFailureMs + cooldownMs` (default 5 min, `:44`), permitiendo reintentar si ese instante ya pasó; (3) en
  otro caso, no degradado. Nunca lanza: entradas no finitas o negativas se sanean a 0 o a los defaults.
- **`formatDegradedNotice(reason)`** (`degraded-mode.ts:136-149`) traduce el motivo a un aviso corto en
  español ("se agotó el presupuesto…", "se pausó temporalmente…", "vuelve a estar disponible…").

## Evidencia
- `modules/ai/src/degraded-mode.ts:16-149`.
- Tests exhaustivos: `modules/ai/src/degraded-mode.test.ts:19-206` (umbral, prioridad de presupuesto,
  cooldown, opciones personalizadas, entradas anómalas, determinismo, `formatDegradedNotice`).

## Estado / cableado
`partial`. **`decideDegradedMode` y `formatDegradedNotice` NO están cableados** en `apps/bot` ni `apps/worker`
(grep sin resultados fuera de su propio fichero y sus tests). Es lógica implementada y probada, pero todavía sin
integrar en ningún handler.

Los mecanismos de degradación que SÍ están activos hoy son otros dos, no este módulo:
1. **Circuit breaker del `AiRouter`** (`modules/ai/src/provider.ts:485-557`): abre el breaker por proveedor tras
   3 fallos durante 30 s y cae al siguiente; marca `degraded` en el `AiResult`.
2. **Presupuesto de tokens por chat** (`AI_TOKEN_BUDGET = 2_000_000`) comprobado en cada superficie antes de
   llamar al proveedor (`apps/bot/src/bot-update.service.ts:5047-5054`, `:17755-17765`, `:17885-17892`), que
   responde "Se ha agotado el presupuesto de IA de este chat".

## Preguntas abiertas
- Falta cablear `decideDegradedMode`/`formatDegradedNotice` a un estado real por grupo (fallos consecutivos +
  flag de presupuesto). Hoy el "budget exceeded" del handler es un umbral duro inline, no la política de este
  módulo.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Selección de Proveedor de IA]], [[Cuotas de IA]]
