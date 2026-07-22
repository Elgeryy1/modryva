---
id: modryva-pantalla-listas
title: Pantalla listas
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/filters/page.tsx
  - apps/web/app/config/blocklist/page.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Filtros
  - Palabras prohibidas
  - Blocklist
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla listas

## Qué es
Nota que agrupa las dos pantallas de **listas** de un grupo (rutas estáticas separadas, formato idéntico: lista + formulario de alta):

### `/config/filters` — Filtros
**Respuestas automáticas** a palabras clave: por cada `trigger` el bot responde con un texto. Lista con botón "×" para quitar y formulario palabra/respuesta (`filters/page.tsx:94-168`). Requiere `gid` (`filters/page.tsx:41-45`).

### `/config/blocklist` — Palabras prohibidas
**Blocklist** con acción configurable al detectar (`Segmented`): Borrar / Avisar / Silenciar / Expulsar / Sacar (`BLOCKLIST_MODES` de `lib/config-meta.ts:24-30`, labels `blocklist/page.tsx:29-39`). Lista de palabras (admite `*` comodín) + motivo opcional (`blocklist/page.tsx:131-204`). Requiere `gid` (`blocklist/page.tsx:56-60`).

Ambas viven en el menú `[[Pantalla config]]` bajo "Moderación" (filters) y "Sanciones" (blocklist), con `href` propio (`config/page.tsx:226-259`).

## Ruta y componentes
- Rutas Next reales: `/config/filters` y `/config/blocklist`, client components con `<Suspense>` (`filters/page.tsx:172-184`, `blocklist/page.tsx:208-220`).
- Kit UI compartido: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Field`, `Group`, `Row`, `Section`, `SkeletonList`, `useBackButton`; blocklist añade `Segmented`.

## Datos (API) — bajo `/v1/miniapp/groups/{gid}/*`
- Filtros: `getFilters` → `GET .../filters` (`api.ts:200`); `addFilter` → `POST .../filters` (`api.ts:203`); `removeFilter` → `DELETE .../filters/{id}` (`api.ts:210`).
- Blocklist: `getBlocklist` → `GET .../blocklist` (`api.ts:168`); `setBlocklistMode` → `POST .../blocklist/mode` (`api.ts:172`); `addBlocklistEntry` → `POST .../blocklist/entries` (`api.ts:182`); `removeBlocklistEntry` → `DELETE .../blocklist/entries/{id}` (`api.ts:189`).
- Ver `[[Controller lists]]`.

## Estado
Ambas implementadas y cableadas. Actualización optimista de la lista local tras alta/baja (`filters/page.tsx:64-67`, `blocklist/page.tsx:99-105`).

## Preguntas abiertas
- (ninguna; las dos pantallas son CRUD directo sobre el API)

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller lists]], [[Pantalla config-section]], [[Pantalla automations]]
