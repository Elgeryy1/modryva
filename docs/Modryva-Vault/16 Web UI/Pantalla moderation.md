---
id: modryva-pantalla-moderation
title: Pantalla moderation
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/moderation/page.tsx
  - apps/web/lib/api-moderation.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Bandeja de moderacion
  - Moderation inbox
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla moderation

## Qué es
**Bandeja de moderación** unificada de toda la red: reportes, cuarentena, apelaciones y tickets en un solo lugar. Permite filtrar por tipo y por grupo, y resolver cada elemento con acciones contextuales. Requiere `gid` (`page.tsx:112-116`).

Elementos:
- Filtro por tipo `Segmented` (Todo/Reportes/Cuarentena/Apelaciones/Tickets, `page.tsx:27-36`, `168-174`).
- Filtro por grupo (solo si hay >1 chat, `page.tsx:176-191`).
- Lista de pendientes con icono/tono por tipo (`page.tsx:38-53`, `203-241`).
- Acciones por tipo (`actionsFor`, `page.tsx:68-93`): report → aprobar/descartar; quarantine → aprobar/borrar; appeal → aceptar/rechazar; ticket → resolver/cerrar. El botón `reject` usa variante `danger`.

Errores mapeados: `invalid-kind`, `invalid-body`, `missing-assignee`, `invalid-assignee`, `resolve-failed`, `not-admin` (`page.tsx:55-63`).

## Ruta y componentes
- Ruta Next real: `/config/moderation` (`apps/web/app/config/moderation/page.tsx`), client component con `<Suspense>` (`page.tsx:246-258`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Group`, `Row`, `Section`, `Segmented`, `SkeletonList`, `useBackButton` (`page.tsx:5-17`).

## Datos (API)
- `getModerationInbox(gid, filters)` → `GET /v1/miniapp/groups/{gid}/moderation/inbox` (con query de filtros, `api-moderation.ts:49`).
- `resolveModerationInboxItem(gid, kind, id, action)` → `POST /v1/miniapp/groups/{gid}/moderation/inbox/{kind}/{id}/resolve` (`api-moderation.ts:60`).
- Ver `[[Controller moderation-inbox]]`, `[[Endpoint GET v1 miniapp groups gid moderation inbox]]`, `[[Endpoint POST v1 miniapp groups gid moderation inbox resolve]]`.

## Estado
Implementada y cableada. Tras resolver hace `load()` para refrescar la lista y `haptic.notify("success")` (`page.tsx:136-155`).

## Preguntas abiertas
- El campo `assignee` de tickets (errores `missing-assignee`/`invalid-assignee`) no tiene input visible en esta pantalla; la asignación puede venir de otro flujo — `unknown`.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller moderation-inbox]], [[Pantalla risk]], [[Pantalla automations]], [[Pantalla network]]
