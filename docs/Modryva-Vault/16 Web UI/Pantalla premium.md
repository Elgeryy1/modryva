---
id: modryva-pantalla-premium
title: Pantalla premium
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/premium/page.tsx
  - apps/web/lib/api-entitlement.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Pantalla entitlement
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla premium

## Qué es
Muestra el **plan y los límites de la red de grupos** y permite **canjear un código** de entitlement; además, para el dueño de la plataforma, **generar códigos** premium. Requiere `gid` (abrir desde el grupo, `page.tsx:55-63`).

Bloques:
- Estado del plan: `plan`, si está `inNetwork`, `chatCount / maxChats` y `premiumUntil` (`page.tsx:125-154`).
- Canjear código: input + `handleRedeem` (`page.tsx:70-87`, `156-173`).
- Generar código (rotulado "solo dueño de la plataforma"): plan, máximo de grupos, días, y muestra el `generatedCode` (`page.tsx:89-111`, `175-215`).

Errores mapeados a español: `not-found`, `already-used`, `not-in-network`, `not-network-admin`, `not-platform-owner`, `invalid-body` (`page.tsx:25-33`).

## Ruta y componentes
- Ruta Next real: `/config/premium` (`apps/web/app/config/premium/page.tsx`), client component con `<Suspense>` (`page.tsx:220-232`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Field`, `Group`, `Row`, `Section`, `SkeletonList`, `useBackButton` (`page.tsx:5-16`).

## Datos (API)
- `getEntitlementStatus(gid)` → `GET /v1/miniapp/groups/{gid}/entitlement` (`api-entitlement.ts:14`).
- `redeemEntitlementCode(gid, code)` → `POST /v1/miniapp/groups/{gid}/entitlement/redeem` (`api-entitlement.ts:17`).
- `generateEntitlementCode(gid, ...)` → `POST /v1/miniapp/groups/{gid}/entitlement/codes` (`api-entitlement.ts:28`).
- Ver `[[Controller entitlement]]`, `[[Endpoint GET v1 miniapp groups gid entitlement]]`, `[[Endpoint POST v1 miniapp groups gid entitlement redeem]]`.

## Estado
Implementada y cableada. La generación de códigos está siempre visible en la UI pero la API rechaza con `not-platform-owner` si no procede (`page.tsx:31`).

## Preguntas abiertas
- El catálogo real de planes (`pro` es el placeholder del input, `page.tsx:180`) y su relación con el "Pack de IA" se resuelve en la API; es `unknown` desde el front.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller entitlement]], [[Pantalla platform]], [[Pantalla ai-pack]], [[Pantalla network]]
