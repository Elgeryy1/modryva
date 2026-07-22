---
id: modryva-pantalla-analytics
title: Pantalla analytics
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/analytics/page.tsx
  - apps/web/lib/api-analytics.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Analiticas de red
  - Doctor de red
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla analytics

## Qué es
**Analíticas de red**: actividad, salud y recomendaciones de todos los grupos de la red. Requiere `gid` (`page.tsx:52-60`).

Bloques (`page.tsx:110-252`):
- KPIs: grupos, mensajes totales, usuarios activos, salud de la red (`healthScore/100`, tono según ≥70).
- Top posters de la red completa.
- Actividad reciente por día.
- Raid/spam por hora del día: calcula la hora pico con `reduce` (`page.tsx:88-93`, `182-195`).
- Grupos sin configurar (marca qué falta: captcha/antiflood/bienvenida).
- **Doctor de red**: recomendaciones; algunas con arreglo automático (`enable-captcha`, `enable-antiflood`, `page.tsx:87`) que llaman `applyDoctorFix`.

Errores mapeados: `not-admin`, `not-network-admin`, `chat-not-found`, `invalid-body`, `no-auto-fix` (`page.tsx:24-32`).

## Ruta y componentes
- Ruta Next real: `/config/analytics` (`apps/web/app/config/analytics/page.tsx`), client component con `<Suspense>` (`page.tsx:259-271`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Group`, `Row`, `Section`, `SkeletonList`, `useBackButton` (`page.tsx:5-16`).

## Datos (API)
- `getNetworkAnalytics(gid)` → `GET /v1/miniapp/groups/{gid}/network/analytics` (`api-analytics.ts:42`).
- `applyDoctorFix(gid, recommendationId)` → `POST /v1/miniapp/groups/{gid}/network/doctor/fix` (`api-analytics.ts:45`).
- Ver `[[Controller network-analytics]]`, `[[Endpoint GET v1 miniapp groups gid network analytics]]`.

## Estado
Implementada y cableada. El "Aplicar" del doctor solo aparece para los ids en `autoFixableIds` (`page.tsx:87`, `239-247`).

## Preguntas abiertas
- El resto de recomendaciones (fuera de captcha/antiflood) se muestran como texto sin acción; qué arreglos automáticos añadirá la API es `unknown`.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller network-analytics]], [[Pantalla network]], [[Pantalla risk]], [[Pantalla gamification]]
