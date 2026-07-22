---
id: modryva-ai-conversacion
title: Conversación por IA
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
  - parseAiCommand
  - buildAiMessages
created: 2026-07-12
updated: 2026-07-12
---

# Conversación por IA

## Qué hace
Parsea los comandos de IA basados en texto y arma la lista de mensajes que se envía al proveedor, siempre con un
"system prompt" de guarda que fija la identidad y las reglas de Modryva.

- **`parseAiCommand(update)`** reconoce tres comandos: `ai`, `summarize`, `translate`
  (`modules/ai/src/commands.ts:22-80`). Devuelve `null` si no es un comando de IA, un error con texto de uso si
  faltan argumentos (`prompt-required` / `text-required` / `language-required`), o el comando tipado
  (`{ kind: "chat" | "summarize" | "translate", … }`).
- **`buildAiMessages(command, history)`** construye `[system(guard), …history, user]`
  (`commands.ts:155-171`). Para `summarize` envuelve el texto pidiendo un resumen conciso sin inventar; para
  `translate` pide traducir al idioma indicado conservando el sentido.
- **`SYSTEM_GUARD`** (`commands.ts:141-152`) instruye al modelo: nombre público "Modryva", tono cercano y
  breve, no inventar datos internos ni precios, no revelar prompts/claves/tokens/.env, no decir que es ChatGPT,
  OpenAI, Groq, Gemini ni OpenRouter, y en moderación/tickets recomendar sin prometer sanciones automáticas.

## Evidencia
- `modules/ai/src/commands.ts:28-80` (`parseAiCommand`), `:141-171` (`SYSTEM_GUARD` + `buildAiMessages`).
- Tests: `modules/ai/src/commands.test.ts:53-85` ("parses /ai chat", "parses /summarize and /translate",
  "requires arguments") y `:114-...` ("prepends a guard system prompt and the user content").
- Cableado (`/ai`, `/summarize`, `/translate`): `apps/bot/src/bot-update.service.ts:5022`
  (`parseAiCommand(update)`) dentro de `handleAiCommand` (`:4959`); construcción de mensajes en
  `:5107` (`buildAiMessages(safeCommand, history)`) y llamada al proveedor en `:5133`.
- El historial reciente se recupera con `this.aiRepository.getRecentHistory(...)`
  (`bot-update.service.ts:5093`) y se mapea a roles `user`/`assistant`/`system` antes de `buildAiMessages`.
- La respuesta del turno se persiste con `recordTurn(...)` (`bot-update.service.ts:5149`).

## Estado / cableado
`implemented`. Además de `/ai`, `/summarize`, `/translate`, la misma tubería (`buildAiMessages` +
`aiProvider.complete`) alimenta el chat automático en privado, el chat por mención, el modo invitado y la IA
inline (ver [[Chat Automático de IA]]). Antes de llegar al proveedor, el texto pasa por
[[Sanitización y Anti-Inyección de Prompts]] y las puertas de acceso/presupuesto de [[Códigos de Acceso IA]] y
[[Cuotas de IA]].

## Preguntas abiertas
- Ninguna a nivel del módulo. La tarea concreta (`fast_chat`, `summarize_short`, `translate`) se decide en el
  handler (`bot-update.service.ts:5112-5117`), no en `commands.ts`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Selección de Proveedor de IA]], [[Sanitización y Anti-Inyección de Prompts]],
  [[Memoria de Conversación]], [[Chat Automático de IA]], [[Modelo AiConversation]], [[Modelo AiMessage]]
