---
id: modryva-automation-presets-de-alerta
title: Presets de Alerta
type: feature
domain: automation
status: partial
maturity: experimental
source:
  - modules/automation/src/alert-presets.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - parseAlertPresetCommand
  - buildDiscordAlertPayload
  - buildSlackAlertPayload
created: 2026-07-12
updated: 2026-07-12
---

# Presets de Alerta

## Qué hace
Construye cuerpos de webhook con formato nativo de Discord y Slack para alertas del bot, sobre el mismo
motor HMAC de [[Webhooks Salientes]]. Lógica pura: solo arma el JSON; nunca hace fetch
(`alert-presets.ts:3-7`).

- Severidades `info | warn | critical` con color de embed (`ALERT_SEVERITY_COLORS`, `:37-41`) y emoji
  de cabecera (`ALERT_SEVERITY_EMOJIS`, `:47-51`). `isAlertSeverity` / `alertSeverityColor` /
  `buildAlertTitle` (`:60-74`).
- `buildDiscordAlertPayload(event)` → `{ embeds: [...] }` con color por severidad y campo "Grupo";
  adjunta `url` si existe (`:82-101`).
- `buildSlackAlertPayload(event)` → Block Kit: header + section + bloque de contexto con enlace si hay
  `url` (`:109-141`).
- `parseAlertPresetCommand(update)` parsea `/alertpreset discord|slack|generic`; devuelve null si el
  update no es ese comando, o error `missing-target`/`invalid-target` (`ALERT_PRESET_TARGETS` `:28`,
  `:166-192`).

## Evidencia
- `modules/automation/src/alert-presets.ts:60-192`.
- Exportado en `modules/automation/src/index.ts:1`.
- Tests: `modules/automation/src/alert-presets.test.ts`.
- Invocación en `apps/`: **0 resultados** para `parseAlertPresetCommand` / `buildDiscordAlertPayload`
  → no cableado (no hay handler `/alertpreset` en el bot).

## Estado / cableado
`partial`. Todo el formateo Discord/Slack está listo y testeado, pero **ninguna app lo invoca**: no se
halló handler de `/alertpreset` ni uso de los builders de payload. A diferencia de
[[Webhooks Salientes]] (cableado end-to-end), estos presets quedan como lógica pura sin conectar.

## Preguntas abiertas
- ¿Se planeaba enrutar alertas del bot (antiflood/antiraid/incidentes) a Discord/Slack vía estos
  presets? El disparo/entrega no existe en `apps/` → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Webhooks Salientes]], [[Eventos Internos]]
