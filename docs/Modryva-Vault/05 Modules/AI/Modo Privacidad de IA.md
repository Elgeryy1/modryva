---
id: modryva-ai-modo-privacidad
title: Modo Privacidad de IA
type: feature
domain: ai
status: partial
maturity: stable
source:
  - modules/ai/src/commands.ts
tags:
  - modryva
  - feature
  - ai
aliases:
  - AiPrivacyMode
  - AI_PRIVACY_MODE
created: 2026-07-12
updated: 2026-07-12
---

# Modo Privacidad de IA

## Qué hace
Controla cuánta PII (email y teléfono) se redacta antes de enviar el texto al proveedor. El tipo
`AiPrivacyMode = "safe" | "normal" | "full"` (`modules/ai/src/commands.ts:105`) se pasa a
`sanitizeAiInput(raw, maxLength, privacyMode)`:

- **`full`**: NO redacta email ni teléfono (deja pasar la PII) — condición `if (privacyMode !== "full")` en
  `modules/ai/src/commands.ts:132-136`.
- **`safe` y `normal`**: sí redactan email → `[REDACTED_EMAIL]` y teléfono → `[REDACTED_PHONE]`.

La redacción de secretos (claves/tokens) siempre ocurre, en cualquier modo (`commands.ts:129-131`).

## Evidencia
- Tipo y comportamiento: `modules/ai/src/commands.ts:105`, `:117-136`.
- Enum de entorno: `packages/shared/src/env.ts:138` (`AI_PRIVACY_MODE: z.enum(["safe","normal","full"]).default("normal")`).
- Cableado: se pasa `this.env.AI_PRIVACY_MODE` a `sanitizeAiInput` en `/ai`
  (`apps/bot/src/bot-update.service.ts:5066`), IA inline (`:11668`), modo invitado (`:11771`), DM (`:17770`) y
  mención (`:17897`).
- Se muestra en `/aistatus`: `Privacy mode: ${this.env.AI_PRIVACY_MODE}` (`bot-update.service.ts:5370`).

## Estado / cableado
`partial`. El modo se propaga correctamente a todas las superficies y `full` sí cambia el comportamiento, pero
en el código actual **`safe` y `normal` son indistinguibles**: solo `full` altera la ruta (`!== "full"`). No
existe una diferencia observable entre `safe` y `normal` en `sanitizeAiInput` ni ningún otro efecto de `safe`
verificable en el módulo. Por eso el estado es honesto como `partial` (tres valores declarados, dos con el
mismo efecto).

## Preguntas abiertas
- ¿Se pretende que `safe` sea más estricto que `normal` (p.ej. redactar más categorías)? No hay evidencia de
  esa diferencia en el código → intención de diseño `unknown`.
- El valor por defecto en producción es `normal` salvo override de entorno.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Sanitización y Anti-Inyección de Prompts]], [[Conversación por IA]]
