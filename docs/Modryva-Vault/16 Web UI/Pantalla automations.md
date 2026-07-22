---
id: modryva-pantalla-automations
title: Pantalla automations
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/automations/page.tsx
  - apps/web/lib/api-automation.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Automatizaciones
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla automations

## Qué es
**Automatizaciones**: reglas visuales del tipo "si pasa esto (trigger), y además (condición), haz aquello (acción)". Crea, activa/desactiva y borra reglas. Requiere `gid` y que el grupo esté en una red (error `not-in-network`, `page.tsx:66-71`).

Constructor de regla (`page.tsx:261-463`):
- Triggers (`page.tsx:35-42`): `contains_text`, `contains_link`, `new_member`, `report`, `schedule` (cron), `high_risk`.
- Condiciones (`page.tsx:44-53`): `none`, `is_new_user`, `not_in_chat`, `missing_badge`, `source_chat`.
- Acciones (`page.tsx:55-64`): `delete`, `reply`, `quarantine`, `notify_staff`, `log`, `mute`, `webhook`, `assign_mission`.

Cada tipo pinta campos extra (texto, cron, URL, duración, insignia, etc.) según su `kind` con funciones `defaultTrigger`/`defaultCondition`/`defaultAction` (`page.tsx:76-127`). Lista de reglas existentes con `Toggle` para activar y botón "Borrar" (`page.tsx:465-504`); si `chatId === null` es "toda la red" (`page.tsx:483`).

## Ruta y componentes
- Ruta Next real: `/config/automations` (`apps/web/app/config/automations/page.tsx`), client component con `<Suspense>` (`page.tsx:509-521`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Field`, `Group`, `Row`, `Section`, `SkeletonList`, `Toggle`, `useBackButton` (`page.tsx:5-18`).

## Datos (API) — bajo `/v1/miniapp/groups/{gid}/automations*`
- `getAutomations` → `GET .../automations` (`api-automation.ts:42`).
- `createAutomation` → `POST .../automations` (`api-automation.ts:55`).
- `removeAutomation` → `DELETE .../automations/{id}` (`api-automation.ts:72`).
- `toggleAutomation` → `POST .../automations/{id}/toggle` (`api-automation.ts:84`).
- Ver `[[Controller automation]]`, `[[Endpoint POST v1 miniapp groups gid automations]]`.

## Estado
Implementada y cableada. Requiere red para operar (mensaje explícito en `page.tsx:68-70`).

## Preguntas abiertas
- La ejecución real de cada acción (p. ej. `webhook`, `assign_mission`) y la validez del cron la maneja la API/worker — `unknown` desde el front.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller automation]], [[Pantalla moderation]], [[Pantalla risk]], [[Pantalla network]]
