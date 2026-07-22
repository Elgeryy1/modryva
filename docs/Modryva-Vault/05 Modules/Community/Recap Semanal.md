---
id: recap-semanal
title: Recap Semanal
type: feature
domain: community
status: implemented
maturity: beta
source: [apps/worker/src/recap-processor.ts, apps/worker/src/server.ts, apps/api/src/miniapp/config.controller.ts, packages/shared/src/miniapp-contracts.ts]
tags: [modryva, feature, community]
aliases: [weekly recap, resumen semanal, community.recap.weekly]
created: 2026-07-12
updated: 2026-07-12
---

# Recap Semanal

Post automático, una vez por semana (lunes), con el resumen de actividad del grupo. **Opt-in** por grupo. Aunque es una feature de comunidad, su código **no está en `modules/community`** sino en el worker: `apps/worker/src/recap-processor.ts`.

## Opt-in y activación

Se activa por grupo escribiendo `{ enabled: true }` en la `ChatSetting` con clave `weekly_recap` (`WEEKLY_RECAP_KEY`, `packages/shared/src/miniapp-contracts.ts:191`). El toggle se expone desde el Mini App: `GET/PUT groups/:gid/weekly-recap` (`apps/api/src/miniapp/config.controller.ts:329-364`).

## Job

Corre como `community.recap.weekly` (`apps/worker/src/server.ts:65`), que invoca `processWeeklyRecap` (`apps/worker/src/server.ts:176-181`; def. en `recap-processor.ts:220`). El job tickea con frecuencia pero solo publica al abrirse una semana nueva.

## Semana e idempotencia

- La semana se alinea a lunes 00:00 UTC vía `weekKeyFromMs` (`recap-processor.ts:34-35`).
- Idempotencia por semana con un marcador `{ lastWeek }` en la `ChatSetting` `weekly_recap_state` (`WEEKLY_RECAP_STATE_KEY`, `recap-processor.ts:11`). La **primera vez** que ve un grupo siembra la semana **sin publicar** (evita spam a mitad de semana; `recap-processor.ts:248-258`), y a partir de ahí publica exactamente una vez cuando avanza la semana. El marcador se avanza **antes** de intentar publicar, para que un fallo no re-dispare cada minuto (`recap-processor.ts:264-271`).

## Contenido: stats agregadas → IA opcional → fallback

- `summarizeWeek` (`recap-processor.ts:82-123`) reduce el log de actividad a stats agregadas **sin texto de mensajes**: nº de mensajes, participantes, top 3 posters y día más movido.
- Umbral mínimo: si hay menos de `MIN_MESSAGES_FOR_RECAP = 8` mensajes, no publica (semana casi muerta; `recap-processor.ts:17,286-289`).
- Narración IA opcional: `narrateWithAi` (`recap-processor.ts:158-185`) pide a `AiProvider` un texto cálido de 2-3 frases (`task: "summarize_short"`, `maxTokens: 220`) construido **solo** a partir de las stats. Si la IA está desactivada, degradada o falla, devuelve `null`.
- **Fallback determinista**: `renderStatsRecap` (`recap-processor.ts:126-142`) genera la tarjeta de stats en Markdown cuando no hay narración IA (`recap-processor.ts:298-300`).

## Gate de modo silencio

Es un mensaje no pedido, así que respeta [[Quiet Mode]]: antes de publicar consulta la `ChatSetting` `chat_quiet` (`CHAT_QUIET_KEY`) y, si está activo, se salta el grupo (`recap-processor.ts:273-282`).

Ver el flujo completo en [[Flujo Recap Semanal]].

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo ChatSetting]], `AiProvider` (`@superbot/module-ai`), `PublishGateway`
- **Consume**: log de actividad del chat (`ChatActivityEntry`), [[Quiet Mode]]
- **Produce**: [[Job community.recap.weekly]]
- **Relacionado con**: [[Activity y Analytics]], [[Flujo Recap Semanal]]
