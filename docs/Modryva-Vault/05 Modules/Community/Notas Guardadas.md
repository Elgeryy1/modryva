---
id: modryva-community-notas-guardadas
title: Notas Guardadas
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/notes.ts
  - modules/community/src/notes-extra.ts
tags:
  - modryva
  - feature
  - community
aliases: [notas, notes, save, hashtag]
created: 2026-07-12
updated: 2026-07-12
---

# Notas Guardadas

## Qué hace
Notas por grupo estilo Rose/GroupHelp: los admins guardan textos con un nombre y cualquiera los recupera. Incluye recall por hashtag (`#nombre` en un mensaje suelto) e import/export portable en JSON.

## Evidencia
- Parser de comandos `parseNotesCommand` acepta `save`/`get`/`notes`/`clear` (`modules/community/src/notes.ts:18-79`); `normalizeNoteName` quita `#` y baja a minúsculas (`notes.ts:25-26`).
- Recall por hashtag: `detectNoteRecall` casa `^#(palabra)$` en texto suelto (`notes.ts:85-94`).
- Portabilidad: `parseNotesPortCommand` (`export`/`import`), `serializeNotes` y `parseNotesImport` (tope 200 notas, nunca lanza) en `modules/community/src/notes-extra.ts:28-116`.
- Tests: `modules/community/src/notes.test.ts`, `modules/community/src/notes-extra.test.ts`.

## Estado / cableado
Implemented. `handleNotesCommand` invoca `parseNotesCommand` y persiste con `notesRepository` (list/get/save/delete) exigiendo permiso `notes.write` para escribir (`apps/bot/src/bot-update.service.ts:3456-3555`). El recall por hashtag tiene handler propio `handleNoteRecall` (`bot-update.service.ts:3557-3579`). El import/export vive en `bot-update.service.ts:13097-13140`. Los símbolos se importan del paquete community (`bot-update.service.ts:180,227,243,245,295`).

## Preguntas abiertas
- Nombre exacto del modelo Prisma tras `notesRepository` → `unknown` (se enlaza como [[Modelo Note]] a modo de ghost link).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]], [[Modelo Note]]
- Relacionado con: [[Filters]], [[Custom Commands]], [[Comando save]]
