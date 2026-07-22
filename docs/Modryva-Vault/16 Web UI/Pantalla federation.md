---
id: modryva-pantalla-federation
title: Pantalla federation
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/federation/page.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Federacion
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla federation

## Qué es
**Federación**: comparte baneos entre varios grupos. Permite crear/unirse/salir de una federación, banear/desbanear, gestionar admins, renombrar, eliminar y suscribirse a otra federación de la que hereda baneos. Requiere `gid` (`page.tsx:54-66`).

Vista sin federación (`page.tsx:538-587`): crear (nombre) o unirse (ID).

Vista con federación (`page.tsx:283-537`):
- Cabecera: nombre, rol (dueño/admin/vinculado), nº grupos, nº baneados, `fedId` para vincular.
- Grupos vinculados y baneados (con desbanear).
- Banear a alguien (solo `isFedAdmin`, `page.tsx:375-402`).
- Admins de la federación (añadir/quitar, solo `isOwner`, `page.tsx:404-459`).
- Renombrar y **zona peligrosa**: eliminar federación (solo `isOwner`, `page.tsx:461-490`).
- Suscripción a otra federación para heredar baneos (`page.tsx:492-532`).

## Ruta y componentes
- Ruta Next real: `/config/federation` (`apps/web/app/config/federation/page.tsx`), client component con `<Suspense>` (`page.tsx:593-605`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Caption`, `Empty`, `Field`, `Group`, `Row`, `Section`, `SkeletonList`, `useBackButton` (`page.tsx:5-18`).

## Datos (API) — bajo `/v1/miniapp/groups/{gid}/federation*`
- `getFederationStatus` → `GET .../federation` (`api.ts:244`).
- `createFederation` / `deleteFederation` → `POST` / `DELETE .../federation` (`api.ts:247`, `259`).
- `joinFederation` → `.../federation/join` (`api.ts:253`); `addFedBan`/`removeFedBan` → `.../federation/bans` (`api.ts:269`, `265`).
- `addFedAdmin`/`removeFedAdmin` → `.../federation/admins` (`api.ts:274`, `281`); `renameFederation` → `.../federation/rename` (`api.ts:285`); `leaveFederation` → `.../federation/all` (`api.ts:291`); suscripción → `.../federation/subscription` (`api.ts:296`, `302`).
- Ver `[[Controller federation]]`.

## Estado
Implementada y cableada. Refleja los comandos de chat `/newfed`, `/fban`, `/subfed`, etc. (ver `[[Pantalla help]]`).

## Preguntas abiertas
- La herencia de baneos por suscripción (`subscribedFedId`) y su resolución en cascada la maneja la API — `unknown` desde el front.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller federation]], [[Pantalla network]], [[Pantalla moderation]], [[Pantalla help]]
