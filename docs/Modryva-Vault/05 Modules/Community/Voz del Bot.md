---
id: modryva-community-voz-bot
title: Voz del Bot
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/bot-voice.ts
tags:
  - modryva
  - feature
  - community
aliases: [voz, bot voice, tono, personalidad]
created: 2026-07-12
updated: 2026-07-12
---

# Voz del Bot

## Qué hace
Tono/personalidad del bot por grupo: `/voz <tono>` (serio, cercano, gamer, academico, ironico) decora los mensajes salientes con un prefijo/sufijo característico. `serio` es neutro (sin cambios).

## Evidencia
- `BOT_VOICES` y type guard `isBotVoice` (`modules/community/src/bot-voice.ts:11-27`).
- `VOICE_DECORATORS` y `applyBotVoice(baseMessage, voice)` (tono inválido → mensaje intacto) (`bot-voice.ts:29-51`).
- `parseVoiceCommand` con errores `missing-voice`/`invalid-voice` (`bot-voice.ts:77-95`).
- Test: `modules/community/src/bot-voice.test.ts`.

## Estado / cableado
Implemented. Handler en `apps/bot/src/bot-update.service.ts:12123` (`parseVoiceCommand`); confirma el cambio con `applyBotVoice(\`Tono del bot ajustado a "${voice}".\`, voice)` (`bot-update.service.ts:12163`). Imports en `bot-update.service.ts:123,262`.

## Preguntas abiertas
- Alcance real de la decoración: no se verificó que `applyBotVoice` envuelva TODAS las respuestas del bot en ese grupo (más allá de la confirmación) ni dónde se persiste el tono elegido → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Settings Panel]], [[Comando voz]]
