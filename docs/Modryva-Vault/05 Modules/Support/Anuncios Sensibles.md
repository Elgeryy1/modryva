---
id: modryva-support-sensitive-announcement
title: Anuncios Sensibles
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/sensitive-announcement.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Anuncios Sensibles

## Qué hace
Detecta anuncios de admin que podrían generar polémica dentro de una comunidad y
avisa antes de publicar. `detectSensitiveAnnouncement(text)` normaliza a ASCII
sin acentos y busca (con límites de palabra) términos de seis categorías:
`politica`, `religion`, `precios`, `cierre`, `despido`, `cambios`. Devuelve
`sensitive` más los topics en orden de declaración, deduplicados.
`describeSensitiveWarning` construye el aviso en español ("Este anuncio puede
generar polémica: ...").

## Evidencia
- `modules/support/src/sensitive-announcement.ts:142`
  `detectSensitiveAnnouncement`; `sensitive-announcement.ts:163`
  `describeSensitiveWarning`; reglas por topic en `sensitive-announcement.ts:39`.
- Test: `modules/support/src/sensitive-announcement.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:531` (import) y
  `bot-update.service.ts:16494` (`detectSensitiveAnnouncement(text)`), servido
  por el comando `/anuncio_sensible` dentro de `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuesto como comando `/anuncio_sensible`. Complementa el análisis
de tono de [[Composición de Anuncios]] (que tiene su propia detección de temas
sensibles política/dinero/salud); estas dos taxonomías conviven.

## Preguntas abiertas
- No verificado si el aviso bloquea el envío del anuncio o solo lo advierte →
  `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Composición de Anuncios]], [[Anuncios por Rol y Vista Previa]]
