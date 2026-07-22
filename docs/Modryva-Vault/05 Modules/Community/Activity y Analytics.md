---
id: activity-y-analytics
title: Activity y Analytics
type: feature
domain: community
status: implemented
maturity: stable
source: [modules/community/src/analytics.ts, apps/bot/src/bot-update.service.ts, packages/data/prisma/schema.prisma]
tags: [modryva, feature, community]
aliases: [stats, activity, topposters, analitica, actividad]
created: 2026-07-12
updated: 2026-07-12
---

# Activity y Analytics

Registro de actividad del grupo y estadísticas al estilo Combot. Lógica pura en `modules/community/src/analytics.ts`; persistencia en [[Modelo ActivityDaily]] + [[Modelo UserActivity]].

## Registro (logger)

Cada mensaje se contabiliza:
- `chat-activity.logger` (`apps/bot/src/bot-update.service.ts:1113`) alimenta el log usado por [[Recap Semanal]].
- `activity-record` y `activity-xp` (`bot-update.service.ts:1789,1795`) actualizan contadores diarios ([[Modelo ActivityDaily]]) y por usuario ([[Modelo UserActivity]]).

## Comandos de stats

Parser `parseStatsCommand` (`analytics.ts:21-34`), handler `stats.command` (`bot-update.service.ts:1363`). Nombres: `stats`, `activity`, `topposters`, `topmsg`, `topactive` (`analytics.ts:13-19`):

- `/stats` — resumen (mensajes totales, hoy y últimos 7 días; `docs/COMMANDS.md:257`).
- `/activity` — ventana de actividad.
- `/topposters` (y alias) — ranking de más activos, render con `formatTopPosters` (`analytics.ts:39-60`, medallas de podio).

## Helpers puros

- `dayKeyFromMs(ms)` (`analytics.ts:66-67`): bucket UTC `YYYY-MM-DD` estable.
- `sumRecentMessages(windows, todayMs, days)` (`analytics.ts:78-88`): suma los mensajes de los últimos `days` buckets.

## Persistencia

- [[Modelo ActivityDaily]]: mensajes por día (unique `[chatId, day]`).
- [[Modelo UserActivity]]: mensajes por usuario (unique `[chatId, telegramUserId]`).

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo ActivityDaily]], [[Modelo UserActivity]]
- **Utilizado por**: [[Comando stats]] (`/stats`), [[Recap Semanal]]
- **Relacionado con**: [[Events Map]], [[Commands Map]]
