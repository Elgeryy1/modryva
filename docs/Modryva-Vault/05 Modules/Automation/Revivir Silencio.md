---
id: modryva-automation-revivir-silencio
title: Revivir Silencio
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/revive-silence.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - checkReviveSilence
created: 2026-07-12
updated: 2026-07-12
---

# Revivir Silencio

## Qué hace
Decide si un grupo dormido debe recibir un rompehielos suave. `checkReviveSilence({
minutesSinceLastMessage }, options?)` → `{ revive, prompt }` (`revive-silence.ts:68-81`):

- Se considera dormido cuando `minutesSinceLastMessage >= quietThresholdMin` (por defecto 120)
  (`DEFAULT_QUIET_THRESHOLD_MIN` `:29`, `:77-80`).
- Entradas no finitas/negativas y umbrales inválidos se tratan seguros (no revive / umbral por
  defecto) (`:74-76`, `resolveThreshold` `:42-47`).
- El rompehielos escala con el silencio: elige entre 3 mensajes en español según cuántas "ventanas"
  de silencio han pasado (`REVIVE_SILENCE_ICEBREAKERS` `:36-40`, `pickIcebreaker` `:49-57`); si
  `revive` es false, `prompt` es "". Pura y determinista.

## Evidencia
- `modules/automation/src/revive-silence.ts:68-81`.
- Cableado en el bot, comando `/revivir_silencio <minutos_desde_ultimo>`:
  `apps/bot/src/bot-update.service.ts:16324` (case), `:16329`
  `checkReviveSilence({ minutesSinceLastMessage })`, respuesta con `decision.prompt` en `:16330-16334`.
- Import: `apps/bot/src/bot-update.service.ts:106`.
- Tests: `modules/automation/src/revive-silence.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta desde `/revivir_silencio`, pero el comando es **diagnóstico**: el
usuario pasa los minutos de silencio y el bot muestra el rompehielos que enviaría; no vigila la
inactividad del grupo ni publica el mensaje por sí solo. Sería una automatización periódica ideal, pero
hoy no hay scheduler que lo dispare.

## Preguntas abiertas
- ¿Hay un job/cron que mida el silencio real por chat y llame a esto? No observable desde el módulo →
  `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Cierre de Tema]], [[Modo Evento Manual]]
