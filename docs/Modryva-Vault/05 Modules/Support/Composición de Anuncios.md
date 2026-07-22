---
id: modryva-support-announcement-composer
title: Composición de Anuncios
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/announcement-composer.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Composición de Anuncios

## Qué hace
Analiza el texto de un anuncio antes de enviarlo: test de claridad, tono y temas
sensibles. `analyzeAnnouncement(text)` devuelve si el largo es válido
(12–600 caracteres), problemas de claridad (demasiado corto/largo, bloque sin
puntuación, agresividad por exceso de "!", mayúsculas o palabras hostiles), el
tono detectado (`serio|cercano|hype|urgente|tecnico`, con prioridad
urgente > hype > tecnico > cercano) y flags de temas sensibles (política, dinero,
salud). `buildAnnouncementPreview` compone el resumen previo al envío ("Vas a
enviar esto a N grupos y fijar en M"). Puro y determinista.

## Evidencia
- `modules/support/src/announcement-composer.ts:281` `analyzeAnnouncement`;
  `announcement-composer.ts:229` `detectAnnouncementTone`;
  `announcement-composer.ts:332` `buildAnnouncementPreview`.
- Test: `modules/support/src/announcement-composer.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:501` (import) y
  `bot-update.service.ts:10087` (`analyzeAnnouncement(text)`) dentro de
  `handleAnnouncementCommand`.

## Estado / cableado
`implemented`: `analyzeAnnouncement` está cableado al comando de anuncios
(`handleAnnouncementCommand`), no solo a la superficie de utilidades.

## Preguntas abiertas
- No verificado si el resultado del análisis bloquea el envío o solo avisa al
  admin → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Anuncios Sensibles]], [[Anuncios por Rol y Vista Previa]], [[Caducidad de Anuncios]]
