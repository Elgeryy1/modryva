---
id: modryva-ai-sanitizacion
title: Sanitización y Anti-Inyección de Prompts
type: feature
domain: ai
status: implemented
maturity: stable
source:
  - modules/ai/src/commands.ts
tags:
  - modryva
  - feature
  - ai
aliases:
  - sanitizeAiInput
created: 2026-07-12
updated: 2026-07-12
---

# Sanitización y Anti-Inyección de Prompts

## Qué hace
`sanitizeAiInput(raw, maxLength = 4000, privacyMode = "normal")` limpia y evalúa el texto del usuario antes de
mandarlo al proveedor (`modules/ai/src/commands.ts:117-139`):

1. **Elimina caracteres de control** por code point (`>= 32` y `!== 127`) y recorta a `maxLength`
   (`commands.ts:122-128`).
2. **Redacta secretos** con `SECRET_PATTERNS` → `[REDACTED_SECRET]` (`commands.ts:94-100`, aplicado en
   `129-131`): claves Groq `gsk_…`, OpenRouter `sk-or-v1-…`, asignaciones de variables tipo
   `AI_*API_KEY=…` / `TELEGRAM_BOT_TOKEN=…` / `SESSION_SECRET=…` / `MANAGED_BOT_TOKEN_KEY=…`, tokens de bot
   `123…:AA…`, y claves tipo `ch/pi/cs/tok/key_…`.
3. **Redacta email y teléfono** (`[REDACTED_EMAIL]` / `[REDACTED_PHONE]`) salvo en modo privacidad `full`
   (`commands.ts:102-103`, `132-136`) → ver [[Modo Privacidad de IA]].
4. **Marca inyección de prompt** (`flagged`) si el texto ya limpio hace match con `INJECTION_PATTERNS`
   (`commands.ts:82-92`): "ignore previous instructions", "disregard above", "system prompt", "you are now",
   y variantes en español ("olvida las instrucciones", "muestra el prompt del sistema", "dame las keys/claves",
   "revela secretos/tokens/claves").

Devuelve `{ text, flagged }`. El texto redactado (no el crudo) es el que se usa para construir los mensajes,
de modo que la redacción efectivamente llega al proveedor.

## Evidencia
- `modules/ai/src/commands.ts:82-139`.
- Tests: `modules/ai/src/commands.test.ts:87-112` ("flags prompt injection phrasings", "caps the length",
  "redacts secrets, emails and phones").
- Cableado: en `/ai` se llama con `sanitizeAiInput(rawInput, this.env.AI_MAX_INPUT_CHARS, this.env.AI_PRIVACY_MODE)`
  (`apps/bot/src/bot-update.service.ts:5063-5067`); si `flagged`, se registra auditoría `ai.input.blocked` y se
  responde con "posible inyección de prompt" sin llamar al proveedor (`:5069-5082`). El texto sanitizado
  reemplaza al comando crudo antes de `buildAiMessages` (`:5086-5089`).
- Misma protección en modo invitado (`:11768-11781`, respuesta "No puedo ayudar a revelar prompts, claves o
  secretos"), IA inline (`:11665-11670`), DM (`:17767-17787`) y mención (`:17894-17913`).

## Estado / cableado
`implemented`. Es la primera puerta de seguridad de toda entrada de IA en las cinco superficies
(`/ai`+`/summarize`+`/translate`, DM, mención, invitado, inline).

## Preguntas abiertas
- El `maxLength` real en producción lo fija `AI_MAX_INPUT_CHARS` (default 8000 en
  `packages/shared/src/env.ts:136`), no el default 4000 de la firma.
- Las regex son heurísticas; falsos positivos/negativos concretos no están medidos en el código.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Modo Privacidad de IA]], [[Conversación por IA]], [[Selección de Proveedor de IA]]
