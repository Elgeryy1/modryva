---
id: modryva-ai-memoria
title: Memoria de Conversación
type: feature
domain: ai
status: implemented
maturity: stable
source:
  - modules/ai/src/memory.ts
tags:
  - modryva
  - feature
  - ai
aliases:
  - extractAiMemoryFacts
  - buildAiMemorySystemHint
created: 2026-07-12
updated: 2026-07-12
---

# Memoria de Conversación

## Qué hace
Da a la IA una memoria persistente ligera basada en "hechos" (facts) extraídos del texto del usuario y en el
perfil disponible del usuario/chat.

- **`extractAiMemoryFacts(text)`** detecta de forma conservadora hechos estables mediante patrones regex
  (`modules/ai/src/memory.ts:52-101`): `preferred_name` ("me llamo / mi nombre es / soy"),
  `preferred_address` ("llámame / prefiero que me llames"), `location` ("soy de / vivo en / estoy en"),
  `preference` ("me gusta / prefiero") con `scope: "user"`, y `group_purpose` ("este grupo es para / aquí
  hablamos de") con `scope: "chat"`. Cada valor se compacta y se filtra con `isUsefulValue` (2–160 chars, sin
  `{}<>`) (`memory.ts:20-24`).
- **`buildAiMemorySystemHint(profile)`** arma un system prompt de "contexto persistente" con nombre visible,
  username, user id, idioma Telegram, chat/grupo y tipo de chat, más los facts de usuario y de chat; devuelve
  `undefined` si no hay suficientes líneas (`memory.ts:26-50`). Incluye la instrucción de usar la memoria solo
  cuando sea relevante y de no revelar que existe una base de datos de memoria salvo que se pregunte.

## Evidencia
- `modules/ai/src/memory.ts:20-101`.
- Tests: `modules/ai/src/memory.test.ts:4-...` ("extracts stable user facts conservatively", "extracts chat
  purpose facts", "builds a system hint with user, chat and memory facts").
- Cableado (lectura): `apps/bot/src/bot-update.service.ts:5375-5401` (`buildAiMemoryHint`) obtiene los facts con
  `this.aiRepository.getMemories(...)` y llama a `buildAiMemorySystemHint`; el hint se inserta con
  `addAiMemoryHint` (`:5403-5410`) como segundo mensaje `system`.
- Cableado (escritura): `apps/bot/src/bot-update.service.ts:5412-5434` (`rememberAiFacts`) llama a
  `extractAiMemoryFacts(text)` y hace `upsertMemory(...)` con `source: "user"`, `confidence: 0.85`.
- Historial de turnos (distinto de los facts) se guarda/lee con `recordTurn` / `getRecentHistory`
  (`bot-update.service.ts:5149`, `:5093`) y se borra con `/aiforget` → `clearConversation`
  (`:5004-5012`).

## Estado / cableado
`implemented`. La memoria de facts se persiste vía el repositorio de IA (modelo [[Modelo AiMemory]]); el
historial de conversación reciente se persiste en [[Modelo AiConversation]] / [[Modelo AiMessage]]. Los dos
mecanismos son independientes: `memory.ts` solo cubre la extracción de facts y el hint; el turn-history y su
borrado viven en la capa `apps/bot` + repositorio.

## Preguntas abiertas
- El número de facts recuperados, la retención y el TTL de la memoria dependen del repositorio
  (`aiRepository.getMemories` / `upsertMemory`), fuera de `modules/ai/src`; su política concreta es `unknown`
  desde este módulo.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo ai]]
- Relacionado con: [[Conversación por IA]], [[Chat Automático de IA]], [[Modelo AiMemory]],
  [[Modelo AiConversation]], [[Modelo AiMessage]]
