---
id: modryva-pantalla-backup
title: Pantalla backup
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/backup/page.tsx
  - apps/web/lib/api-backup.ts
tags:
  - modryva
  - screen
  - web
aliases:
  - Copias de seguridad
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla backup

## Qué es
**Copias de seguridad** de la configuración del grupo: exportar a JSON, importar (sobreescribe), clonar a otro grupo y aplicar una plantilla de negocio. Requiere `gid` (`page.tsx:57-67`, `142-159`).

Bloques:
- Exportar: `handleExport` muestra el JSON en un `textarea` de solo lectura + "Copiar JSON" con `navigator.clipboard` (`page.tsx:97-112`, `173-198`).
- Importar: parsea el JSON pegado y avisa que **sobreescribe todo** (`page.tsx:114-123`, `200-223`).
- Clonar a otro grupo: pide el `telegramChatId` destino (`page.tsx:125-134`, `225-252`).
- Plantillas de negocio: lista de `templates` y `handleApplyTemplate` (`page.tsx:136-140`, `254-277`).

Cubre las secciones: captcha, antiflood, locks, bienvenida, reglas, higiene y membresía (`page.tsx:178-179`). Errores mapeados: `invalid-payload`, `invalid-target`, `unknown-template`, `not-admin`, `chat-not-found` (`page.tsx:29-36`).

## Ruta y componentes
- Ruta Next real: `/config/backup` (`apps/web/app/config/backup/page.tsx`), client component con `<Suspense>` (`page.tsx:282-294`).
- Kit UI: `Screen`, `AppHeader`, `Banner`, `Button`, `Empty`, `Field`, `Group`, `Row`, `Section`, `SkeletonList`, `useBackButton` (`page.tsx:5-17`).

## Datos (API) — bajo `/v1/miniapp/groups/{gid}/backup/*`
- `exportBackup` → `GET .../backup/export` (`api-backup.ts:55`).
- `importBackup` → `POST .../backup/import` (`api-backup.ts:58`).
- `cloneBackup` → `POST .../backup/clone` (`api-backup.ts:64`).
- `getBackupTemplates` → `GET .../backup/templates` (`api-backup.ts:71`).
- `applyBackupTemplate` → `POST .../backup/templates/{id}/apply` (`api-backup.ts:76`).
- Ver `[[Controller backup]]`, `[[Endpoint GET v1 miniapp groups gid backup export]]`, `[[Endpoint POST v1 miniapp groups gid backup import]]`.

## Estado
Implementada y cableada. El formato del payload declara `version` 2 con `sections` y `network` (placeholder del import, `page.tsx:212`).

## Preguntas abiertas
- El catálogo real de "plantillas de negocio" y su contenido se define en la API; aquí solo se listan `id/name/description` (`page.tsx:263-274`).

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Pantalla config]], [[Guard InitData]]
- Relacionado con: [[Controller backup]], [[Pantalla wizard]], [[Pantalla config-section]]
