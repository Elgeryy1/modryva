---
id: modryva-community-rituales
title: Rituales
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/rituals.ts
tags:
  - modryva
  - feature
  - community
aliases: [ritual, rituals, ritos semanales]
created: 2026-07-12
updated: 2026-07-12
---

# Rituales

## Qué hace
Ritos recurrentes semanales (p. ej. "hilo de preguntas de los lunes", "clips de los viernes"): el bot publica un mensaje una vez por semana cuando coinciden el día y la hora. Gestión con `/ritual add|list|remove`. La lógica es pura: día (0-6) y hora (0-23) llegan como enteros, sin reloj ni zona horaria dentro del módulo.

## Evidencia
- `Ritual { weekday, hour, message }` y validadores `isRitualWeekday`/`isRitualHour` (`modules/community/src/rituals.ts:13-39`).
- `isRitualDue` y `dueRituals(rituals, weekday, hour)` devuelven los que disparan en ese instante (`rituals.ts:45-70`); `formatRitual` etiqueta en español (`rituals.ts:87-95`).
- `parseRitualCommand` (add/list/remove) con errores discriminados (`rituals.ts:152-208`).
- Test: `modules/community/src/rituals.test.ts`.

## Estado / cableado
Implemented (gestión). Handler `parseRitualCommand` en `apps/bot/src/bot-update.service.ts:12264`. `dueRituals`/`formatRitual` se importan (`bot-update.service.ts:183,196,269`) para decidir cuáles disparar.

## Preguntas abiertas
- Qué proceso llama a `dueRituals` cada hora para publicar (worker/cron) y con qué zona horaria se calcula `weekday`/`hour` → `unknown`.
- Persistencia de los rituales configurados por grupo (modelo/clave) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Mensajes Programados]], [[Reglas por Horario]], [[Comando ritual]]
