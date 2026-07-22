---
id: modryva-community-reacciones
title: Reacciones
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/reactions.ts
tags:
  - modryva
  - feature
  - community
aliases: [react, reactpost, botones de reaccion, reactions]
created: 2026-07-12
updated: 2026-07-12
---

# Reacciones

## Qué hace
Botones de reacción estilo @ControllerBot: `/react <texto>` publica un mensaje con una fila de emojis (👍 ❤️ 🔥 😂 😮 👏) cuyos contadores en vivo se muestran en la etiqueta de cada botón. Cada pulsación actualiza el conteo.

## Evidencia
- `REACTION_EMOJIS` y su set (`modules/community/src/reactions.ts:9-11`).
- `parseReactCommand` (`react`/`reactpost`, exige texto) (`reactions.ts:27-44`).
- `buildReactionKeyboard` (etiqueta = emoji, o `emoji N` si N>0) y `parseReactionCallback` (`react:<emoji>`) (`reactions.ts:50-78`).
- Test: `modules/community/src/reactions.test.ts`.

## Estado / cableado
Implemented. Handler en `apps/bot/src/bot-update.service.ts:8618` (`parseReactCommand`). El teclado se construye con `buildReactionKeyboard` y las pulsaciones se resuelven con `parseReactionCallback` (importados en `bot-update.service.ts:140,251,252`). El conteo y la edición del mensaje viven en el servicio (la lógica pura solo construye el teclado).

## Preguntas abiertas
- Dónde se almacenan los contadores por mensaje (¿tabla dedicada o chat-setting?) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Polls]], [[Comando react]]
