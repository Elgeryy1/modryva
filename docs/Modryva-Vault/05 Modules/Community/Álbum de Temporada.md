---
id: modryva-community-album-temporada
title: Álbum de Temporada
type: feature
domain: community
status: implemented
maturity: experimental
source:
  - modules/community/src/season-album.ts
tags:
  - modryva
  - feature
  - community
aliases: [album, season album, album de temporada, recuerdos]
created: 2026-07-12
updated: 2026-07-12
---

# Álbum de Temporada

## Qué hace
Álbum de coleccionables de la comunidad: reúne entradas (logros, eventos, momentos) con su categoría y marca de tiempo, y resume el total, el recuento por tipo (ordenado) y el rango temporal cubierto. `/album` lo muestra.

## Evidencia
- `SeasonAlbumEntry { kind, title, atMs }` y `SeasonAlbum { total, byKind, firstAtMs, lastAtMs }` (`modules/community/src/season-album.ts:6-40`).
- `buildSeasonAlbum(entries)` ignora `kind` vacío, tallya por tipo ordenado desc/asc y calcula el span (`season-album.ts:71-106`).
- Test: `modules/community/src/season-album.test.ts`.

## Estado / cableado
Implemented. Handler `/album` (`apps/bot/src/bot-update.service.ts:13002+`) construye el resumen con `buildSeasonAlbum(entries)` (`bot-update.service.ts:13023`). Imports en `bot-update.service.ts:142,291` (`SeasonAlbumEntry`).

## Preguntas abiertas
- De dónde salen las `entries` (¿se registran automáticamente logros/eventos/hitos o se cargan de un chat-setting?) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Hitos de Miembros]], [[Coop Missions]], [[Comando album]]
