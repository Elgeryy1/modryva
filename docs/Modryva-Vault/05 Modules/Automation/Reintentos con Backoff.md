---
id: modryva-automation-reintentos-con-backoff
title: Reintentos con Backoff
type: feature
domain: automation
status: partial
maturity: experimental
source:
  - modules/automation/src/retry-backoff.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - computeBackoffMs
  - shouldRetry
created: 2026-07-12
updated: 2026-07-12
---

# Reintentos con Backoff

## Qué hace
Backoff exponencial con jitter **determinista** para reintentar ante rate-limit (HTTP 429) u otros
fallos transitorios. Puro: sin I/O, sin `Date.now()` y sin `Math.random()`; el jitter se deriva del
número de intento con un hash entero estable, así la misma entrada da siempre la misma salida
(`retry-backoff.ts:1-7`).

- `computeBackoffMs(attempt, baseMs, maxMs)` → espera con "equal jitter" en `[capped/2, capped]`, donde
  `capped = min(2^attempt * baseMs, maxMs)`; siempre `>= 0` y `<= maxMs`; entradas fuera de rango se
  sanean (attempt negativo/no finito → 0; base/max no positivos → devuelve 0) (`:32-52`). El jitter
  usa `retryJitterFraction` (Knuth + xorshift sobre el intento) (`:14-20`).
- `shouldRetry(attempt, maxAttempts)` → true mientras `attempt < maxAttempts`; false ante entradas no
  finitas, attempt negativo o maxAttempts no positivo (`:60-68`).

## Evidencia
- `modules/automation/src/retry-backoff.ts:32-68`.
- Exportado en `modules/automation/src/index.ts:18`.
- Tests: `modules/automation/src/retry-backoff.test.ts`.
- Invocación en `apps/`: **0 resultados** para `computeBackoffMs` / `shouldRetry` → no cableado.

## Estado / cableado
`partial`. Utilidad de resiliencia lista y determinista, pero **ninguna app la usa** (ni el worker de
webhooks, que firma con `signWebhook` pero no importa este backoff). El reintento real de entregas
podría beneficiarse de ella, pero hoy no está conectada.

## Preguntas abiertas
- ¿El reintento actual de webhooks/entregas usa otra estrategia de backoff (en worker/repositorio)? No
  se importa esta función → `unknown`; verificar en `apps/worker`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Webhooks Salientes]], [[Cola de Pendientes]], [[Prioridad Crítica]]
