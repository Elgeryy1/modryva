---
id: modryva-pantalla-ajustes-ligeros
title: Pantalla ajustes ligeros
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/quiet/page.tsx
  - apps/web/app/config/recap/page.tsx
  - apps/web/app/config/rituals/page.tsx
  - apps/web/app/config/schedule-rules/page.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Modo silencio
  - Recap semanal
  - Rituales
  - Ventanas estrictas
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla ajustes ligeros

## Qué es
Nota que agrupa cuatro subpantallas menores de `/config` (rutas estáticas propias, cada una un toggle o un CRUD de horarios):

### `/config/quiet` — Modo silencio
Un único `Toggle`: el bot deja de anunciar subidas de nivel y celebraciones, pero sigue moderando y respondiendo a comandos/IA (`quiet/page.tsx:69-108`). Guardado optimista con revert al fallar (`quiet/page.tsx:46-67`).

### `/config/recap` — Recap semanal
Un único `Toggle`: cada lunes el bot publica un resumen agregado de la semana (nunca contenido de mensajes); respeta el modo silencio (`recap/page.tsx:69-110`).

### `/config/rituals` — Rituales
CRUD de **mensajes semanales**: por (día de la semana, hora UTC) un mensaje que se repite. Un ritual por franja (reemplaza si repites, `rituals/page.tsx:88-100`, `196-201`). Segmented de día + input de hora (0-23) + textarea.

### `/config/schedule-rules` — Ventanas estrictas
CRUD de **franjas horarias** para moderar más fuerte: inicio/fin (0-23) + toggle "estricto" (quita enlaces de no-admins). Cruce de medianoche si inicio > fin; misma hora = todo el día (`schedule-rules/page.tsx:27-33`, `196-200`). Una regla por ventana (reemplaza, `schedule-rules/page.tsx:82-91`).

Las cuatro requieren `gid` (mensaje "Abre esta pantalla desde tu grupo" si falta).

## Ruta y componentes
- Rutas Next reales: `/config/quiet`, `/config/recap`, `/config/rituals`, `/config/schedule-rules`; client components con `<Suspense>`.
- Kit UI compartido: `Screen`, `AppHeader`, `Banner`, `Group`, `GroupNote`, `Row`, `Section`, `SkeletonList`, `Toggle`, `useBackButton`; rituals/schedule-rules añaden `Button`, `Empty`, `Field`; rituals añade `Segmented`.

## Datos (API) — bajo `/v1/miniapp/groups/{gid}/*`
- `getQuiet` / `putQuiet` → `GET`/`PUT .../quiet` (`api.ts:620`, `622`).
- `getWeeklyRecap` / `putWeeklyRecap` → `GET`/`PUT .../weekly-recap` (`api.ts:629`, `631`).
- `getRituals` / `putRituals` → `GET`/`PUT .../rituals` (`api.ts:611`, `613`).
- `getScheduleRules` / `putScheduleRules` → `GET`/`PUT .../schedule-rules` (`api.ts:596`, `600`).
- Ver `[[Controller config]]`.

## Estado
Las cuatro implementadas y cableadas. Coherentes con la memoria del proyecto (modo silencio como gate universal, recap semanal con IA, ventanas estrictas de moderación programada, rituales).

## Preguntas abiertas
- La ejecución programada (publicar rituales, aplicar ventanas estrictas, generar el recap del lunes) la ejecuta el worker/bot, no la Mini App — `unknown` desde el front.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller config]], [[Pantalla config-section]], [[Pantalla automations]], [[Pantalla moderation]]
