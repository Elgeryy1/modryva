---
id: modryva-automation-cierre-de-tema
title: Cierre de Tema
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/topic-close.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - shouldCloseTopic
created: 2026-07-12
updated: 2026-07-12
---

# Cierre de Tema

## Qué hace
Decide si un tema (hilo de foro) debe cerrarse temporalmente por descontrol.
`shouldCloseTopic({ heat, messagesPerMin }, options?)` → `{ close, reason }` (`topic-close.ts:38-72`):

- Cierra cuando `heat >= heatThreshold` (por defecto 8) **O** `messagesPerMin >= rateThreshold` (por
  defecto 30) (`DEFAULT_HEAT_THRESHOLD` `:29`, `DEFAULT_RATE_THRESHOLD` `:30`, `:45-46`).
- `reason` es un mensaje en español distinto según se disparen ambos umbrales, solo temperatura o solo
  ritmo (`:48-71`). Pura y determinista.

## Evidencia
- `modules/automation/src/topic-close.ts:38-72`.
- Cableado en el bot, comando `/cerrar_topic`:
  `apps/bot/src/bot-update.service.ts:16679` (case), `:16679`
  `shouldCloseTopic({ heat, messagesPerMin })`.
- Import: `apps/bot/src/bot-update.service.ts:117`.
- Tests: `modules/automation/src/topic-close.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta desde `/cerrar_topic`, pero el comando es **diagnóstico**: el
usuario pasa `heat` y `messagesPerMin` y el bot dice si cerraría el hilo y por qué; no cierra realmente
el topic (no llama a `closeForumTopic`). Sería el paso final de una automatización anti-descontrol; hoy
solo informa la decisión.

## Preguntas abiertas
- ¿De dónde saldría `heat` (score de temperatura) en continuo, y quién ejecutaría el cierre real del
  topic de Telegram? No observable desde el módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Disparador por Volumen]], [[Revivir Silencio]], [[Reputación de Contenido]]
