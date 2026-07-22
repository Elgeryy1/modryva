---
id: modryva-support-role-announcements
title: Anuncios por Rol y Vista Previa
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/role-announcements.ts
  - modules/support/src/announcement-preview.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Anuncios por Rol y Vista Previa

## Qué hace
Dos ayudas para preparar un anuncio:
- `buildRoleAnnouncements(base, roles)`: genera una variante por rol,
  anteponiendo un saludo adaptado (owner, staff, nuevos, VIP; saludo neutro para
  roles desconocidos) al mensaje base compartido.
- `buildAnnouncementPreviews(text, options)`: renderiza tres vistas del mismo
  anuncio —móvil, escritorio y notificación push (truncada con elipsis a 100
  caracteres por defecto)— para revisar cómo se verá en cada superficie.

## Evidencia
- `modules/support/src/role-announcements.ts:45` `buildRoleAnnouncements`.
- `modules/support/src/announcement-preview.ts:57` `buildAnnouncementPreviews`.
- Tests: `role-announcements.test.ts`, `announcement-preview.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:16347`
  (`buildRoleAnnouncements` → `/anuncios_por_rol`) y
  `bot-update.service.ts:15010` (`buildAnnouncementPreviews` →
  `/vista_anuncio`), en `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuestos como comandos de utilidad `/anuncios_por_rol` y
`/vista_anuncio`. Son ayudas de composición; no se verificó envío automático
segmentado por rol.

## Preguntas abiertas
- ¿El bot envía realmente cada variante al público de su rol, o solo muestra las
  variantes al admin? → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Composición de Anuncios]], [[Anuncios Sensibles]], [[Caducidad de Anuncios]]
