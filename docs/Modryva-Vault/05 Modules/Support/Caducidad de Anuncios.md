---
id: modryva-support-announcement-expiry
title: Caducidad de Anuncios
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/announcement-expiry.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Caducidad de Anuncios

## Qué hace
Decide cuándo desanclar automáticamente un anuncio fijado. `shouldUnpinAnnouncement
(pinnedAtMs, nowMs, options)` es true cuando `nowMs` alcanza o supera el instante
de caducidad `pinnedAtMs + ttlMs`. El TTL por defecto es 7 días
(`ANNOUNCEMENT_DEFAULT_TTL_MS`); un TTL negativo se clampa a 0 (caducidad
inmediata). Puro, sin reloj interno.

## Evidencia
- `modules/support/src/announcement-expiry.ts:43` `shouldUnpinAnnouncement`;
  `announcement-expiry.ts:31` `computeAnnouncementExpiry`; TTL por defecto en
  `announcement-expiry.ts:14`.
- Test: `modules/support/src/announcement-expiry.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:573` (import) y
  `bot-update.service.ts:15329` (`shouldUnpinAnnouncement(...)`), servido por el
  comando `/caducidad_anuncio` dentro de `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuesto como comando `/caducidad_anuncio`. Función pura basada en
reloj inyectado; no se verificó un job programado que desancle de verdad.

## Preguntas abiertas
- ¿Existe un scheduler que evalúe periódicamente la caducidad y desancle, o solo
  se comprueba bajo demanda? → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Composición de Anuncios]], [[Anuncios por Rol y Vista Previa]]
