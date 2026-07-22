---
id: modryva-pantalla-gamification
title: Pantalla gamification
type: screen
domain: web
status: partial
maturity: stable
source:
  - apps/web/app/config/gamification/page.tsx
  - apps/web/lib/api-gamification.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Misiones y gamificacion
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla gamification

## Qué es
**Misiones y gamificación**: progreso, insignias y ranking de la comunidad, más la configuración de los botones de bienvenida. Requiere `gid` (`page.tsx:64-76`).

Bloques (solo se muestran los de red si `inNetwork`, `page.tsx:124-211`):
- Tus misiones (con labels: primer mensaje, leer reglas, unirse al grupo requerido, `page.tsx:34-38`).
- Tus insignias.
- Ranking de la red (por nº de insignias).
- Ranking de este grupo (por puntos) — siempre visible.
- Botones de bienvenida (toggles: rules, otherGroups, support, verify) con `updateWelcomeButtons` (`page.tsx:213-263`).

Errores mapeados: `not-admin`, `invalid-body` (`page.tsx:40-43`).

## Ruta y componentes
- Ruta Next real: `/config/gamification` (`apps/web/app/config/gamification/page.tsx`), client component con `<Suspense>` (`page.tsx:270-282`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Field`, `Group`, `Row`, `Section`, `SkeletonList`, `Toggle`, `useBackButton` (`page.tsx:5-18`).

## Datos (API)
- `getGamificationStatus(gid)` → `GET /v1/miniapp/groups/{gid}/gamification` (`api-gamification.ts:38`).
- `updateWelcomeButtons(gid, buttons)` → `POST /v1/miniapp/groups/{gid}/gamification/welcome-buttons` (`api-gamification.ts:53`).
- Ver `[[Controller gamification]]`, `[[Endpoint GET v1 miniapp groups gid gamification]]`.

## Estado
`partial`: los botones de bienvenida **aún no se persisten** de forma permanente — la propia UI avisa cuando `result.persisted` es `false` ("todavía no tiene un lugar donde persistirlos. Por ahora solo se validan", `page.tsx:114-119`, `saveWelcomeButtons` `page.tsx:83-101`). El resto (misiones/insignias/rankings) es de solo lectura y sí se muestra.

## Preguntas abiertas
- Dónde se persistirán finalmente los botones de bienvenida (`persisted: false`) es un pendiente del backend — `unknown`.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller gamification]], [[Pantalla analytics]], [[Pantalla Mini App]], [[Pantalla games]]
