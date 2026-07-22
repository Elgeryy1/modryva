---
id: modryva-pantalla-risk
title: Pantalla risk
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/risk/page.tsx
  - apps/web/lib/api-risk.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Riesgo de la red
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla risk

## Qué es
**Riesgo de la red**: lista los usuarios con más incidencias en los grupos de la red y permite resetear su perfil de riesgo. Requiere `gid` y que el grupo esté en una red (`page.tsx:64-76`, `122-136`).

Cada fila muestra clasificación (none/low/medium/high con tono, `page.tsx:38-50`), puntaje y desglose (borrados, reportes, cuarentenas, enlaces, sanciones, grupos) y un botón "Resetear" que llama `resetNetworkRiskProfile` (`page.tsx:139-172`).

Errores mapeados: `not-admin`, `not-in-network`, `not-network-admin`, `invalid-user-id` (`page.tsx:27-33`).

## Ruta y componentes
- Ruta Next real: `/config/risk` (`apps/web/app/config/risk/page.tsx`), client component con `<Suspense>` (`page.tsx:179-191`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Group`, `Row`, `Section`, `SkeletonList`, `useBackButton` (`page.tsx:5-17`).

## Datos (API)
- `getNetworkRisk(gid)` → `GET /v1/miniapp/groups/{gid}/network/risk` (`api-risk.ts:27`).
- `resetNetworkRiskProfile(gid, userId)` → `POST /v1/miniapp/groups/{gid}/network/risk/{userId}/reset` (`api-risk.ts:31`).
- Ver `[[Controller network-risk]]`.

## Estado
Implementada y cableada. Tras resetear hace `load()` para refrescar (`page.tsx:83-104`).

## Preguntas abiertas
- La fórmula de `score` y el umbral de cada `classification` los calcula la API — `unknown` desde el front.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller network-risk]], [[Pantalla users]], [[Pantalla moderation]], [[Pantalla network]], [[Pantalla automations]]
