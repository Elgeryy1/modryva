---
id: modryva-ai-chat-automatico
title: Chat Automático de IA
type: feature
domain: ai
status: implemented
maturity: stable
source:
  - modules/ai/src/dm-chat.ts
  - modules/ai/src/mention-chat.ts
tags:
  - modryva
  - feature
  - ai
aliases:
  - shouldAutoChat
  - extractMentionPrompt
created: 2026-07-12
updated: 2026-07-12
---

# Chat Automático de IA

## Qué hace
Permite hablar con la IA sin escribir `/ai`, en dos superficies:

- **Privado (DM).** `shouldAutoChat(update)` decide si un mensaje debe disparar la conversación automática:
  solo cuando es un `message` en chat `private`, es texto con contenido tras `trim()`, no trae comando parseado
  y no empieza por `#` (recall de notas) ni `/` (comando malformado) (`modules/ai/src/dm-chat.ts:11-35`).
  `buildDmSystemHint()` devuelve un hint corto que refuerza identidad "Modryva" y sugiere `/help`
  (`dm-chat.ts:37-44`). `truncateDmInput(text, max)` recorta el texto añadiendo "…" sin exceder el límite
  (`dm-chat.ts:52-60`).
- **Mención en grupo.** `extractMentionPrompt(update, botUsername)` extrae la pregunta cuando un mensaje normal
  de grupo/supergrupo menciona `@usuario_bot` (p.ej. "@modryvabot que tal"), devolviendo `undefined` si no es
  message, no es grupo/supergrupo, ya es comando, no menciona al bot o no queda texto tras quitar la mención
  (`modules/ai/src/mention-chat.ts:15-52`). Así, grupos donde el bot ya es miembro pueden usar la IA sin `/ai`.

## Evidencia
- `modules/ai/src/dm-chat.ts:11-60` y `modules/ai/src/mention-chat.ts:15-52`.
- Tests: `modules/ai/src/dm-chat.test.ts:67-171` (casos true/false de `shouldAutoChat`, `truncateDmInput`,
  `buildDmSystemHint`); `modules/ai/src/mention-chat.test.ts:55-...` (extracción, case-insensitive, `@` inicial,
  mención a otro usuario, fuera de grupo, etc.).
- Cableado DM: `apps/bot/src/bot-update.service.ts:17734-17855` (`handleDmChat`); `shouldAutoChat` en `:17738`,
  y el hint DM se inserta con `messages.splice(1, 0, { role: "system", content: buildDmSystemHint() })` en
  `:17810`.
- Cableado mención: `apps/bot/src/bot-update.service.ts:17863-17959` (`handleMentionChat`); `extractMentionPrompt`
  en `:17867`, usando `this.env.TELEGRAM_BOT_USERNAME`.
- Ambos handlers reutilizan la misma tubería que `/ai`: `requireAiAccess`, presupuesto de tokens
  (`AI_TOKEN_BUDGET = 2_000_000`, `:17755` y `:17885`), `sanitizeAiInput`, `buildAiMessages`, memoria y
  `recordTurn`.

## Estado / cableado
`implemented`. El modo invitado (`handleGuestMessage`, `bot-update.service.ts:11735-11810`) y la IA inline
(`:11653-11701`) son superficies adicionales que también llaman al proveedor y usan `truncateDmInput` +
`sanitizeAiInput`, pero no dependen de `shouldAutoChat`/`extractMentionPrompt`.

## Preguntas abiertas
- `extractMentionPrompt` usa `env.TELEGRAM_BOT_USERNAME`; si ese username no está escopado por bot hijo en un
  despliegue multi-bot, la detección de mención podría no coincidir (relacionado con el trabajo de Platform;
  no verificable aquí).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Conversación por IA]], [[Selección de Proveedor de IA]], [[Códigos de Acceso IA]],
  [[Cuotas de IA]], [[Memoria de Conversación]]
