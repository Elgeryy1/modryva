---
id: modryva-job-recap-weekly
title: Job recap.weekly
type: workflow
domain: community
status: implemented
maturity: beta
source:
  - apps/worker/src/recap-processor.ts
  - apps/worker/src/server.ts
tags:
  - modryva
  - workflow
  - community
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Job recap.weekly

## Qué hace
Genera un **recap semanal** de la comunidad y lo publica (opt-in por grupo). Procesador
`apps/worker/src/recap-processor.ts`; nombre de job `community.recap.weekly` (registrado en `server.ts`).

## Secuencia
1. Fan-out sobre grupos con `weekly_recap` activado (ChatSetting) — [[Recap Semanal]].
2. `summarizeWeek` agrega `ChatActivityEvent` de los últimos 7 días (top posters, día más activo) — **datos
   agregados, nunca mensajes crudos**.
3. Redacción: si hay IA disponible (`buildAiProviderFromEnv`, tarea `summarize_short`) redacta en tono
   natural; si no/degradado, `renderStatsRecap` (fallback). Ver [[Módulo ai]].
4. Publica el recap — **gateado por [[Quiet Mode]]** (`chat_quiet`): en silencio no manda nada.

## Idempotencia
Estado por semana alineada a lunes (`weekly_recap_state {lastWeek}`); `weekKeyFromMs`. Repite ~60s pero
solo publica una vez por semana. Mínimo de mensajes para publicar: `MIN_MESSAGES_FOR_RECAP`.

## Errores
Fallo de IA → fallback a stats (no rompe). Grupo sin actividad suficiente → no publica.

## Tests
`apps/worker/src/recap-processor.test.ts`.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Depende de: [[App worker]], [[Módulo ai]]
- Consume: [[Modelo ChatSetting]], [[Modelo UserActivity]]
- Relacionado con: [[Recap Semanal]], [[Quiet Mode]], [[Flujo Recap Semanal]]
