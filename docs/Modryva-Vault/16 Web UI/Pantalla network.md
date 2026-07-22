---
id: modryva-pantalla-network
title: Pantalla network
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/network/page.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Red de grupos
  - Owner network
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla network

## Qué es
**Red de grupos** del propietario: gestiona varios grupos desde un panel. Permite crear/unir/salir de una red y, para admins de red, configurar roles de grupo, enrutado de eventos, logs centralizados, bienvenida/reglas globales, membresía, renombrar y hacer rollback del último cambio masivo. Requiere `gid` (`page.tsx:162-174`).

Vista sin red (`page.tsx:735-782`): crear red (nombre) o unir con ID.

Vista con red (`page.tsx:358-734`):
- Cabecera: nombre, rol (owner/admin/miembro), grupos conectados, admins de red, `networkId` para unir otros grupos.
- Grupos de la red con estado alineado/desalineado (`page.tsx:391-418`).
- Seguridad de red: rollback del último snapshot (`page.tsx:420-447`).
- Roles por grupo (`MultiToggleRow`: staff, logs, support, announcements, archive, `page.tsx:59-77`, `456-479`).
- Enrutado de eventos ("Dónde va cada cosa"): presets reportes/alertas/logs/soporte con `RouteRow`, más excepciones por grupo (`page.tsx:79-114`, `481-573`); botón "Usar grupos Staff/Logs/Soporte" autocompleta (`fillDestinationsFromRoles`, `page.tsx:304-342`).
- Logs centralizados, bienvenida global, reglas globales, miembros (`membershipMode`), renombrar (`page.tsx:575-722`).

Errores mapeados en `page.tsx:116-127`.

## Ruta y componentes
- Ruta Next real: `/config/network` (`apps/web/app/config/network/page.tsx`), client component con `<Suspense>` (`page.tsx:787-798`).
- Kit UI incluye componentes específicos `MultiToggleRow` y `RouteRow` (`page.tsx:5-20`).

## Datos (API) — bajo `/v1/miniapp/groups/{gid}/network*`
- `getOwnerNetworkStatus` → `GET .../network` (`api.ts:385`).
- `createOwnerNetwork` → `POST .../network` (`api.ts:388`); `joinOwnerNetwork` → `POST .../network/join` (`api.ts:394`); `leaveOwnerNetwork` → `DELETE .../network` (`api.ts:400`).
- `renameOwnerNetwork` → `POST .../network/rename` (`api.ts:405`); `updateOwnerNetworkSettings` → `.../network/settings` (`api.ts:414`); `updateOwnerNetworkRouting` → `.../network/routing` (`api.ts:426`); `rollbackOwnerNetwork` → `.../network/rollback` (`api.ts:432`).
- Ver `[[Controller owner-network]]`.

## Estado
Implementada y cableada; es la pantalla más grande de `/config`. Cada cambio masivo guarda un snapshot para el rollback (`page.tsx:420-447`).

## Preguntas abiertas
- La detección de "desalineado" y `misalignedFields` la calcula la API (`page.tsx:409-413`); criterios exactos `unknown` desde el front.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller owner-network]], [[Pantalla analytics]], [[Pantalla risk]], [[Pantalla moderation]], [[Pantalla premium]]
