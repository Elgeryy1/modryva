---
id: modryva-module-automation
title: Módulo automation
type: module
domain: automation
status: partial
maturity: beta
source:
  - modules/automation/src
tags:
  - modryva
  - module
  - automation
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Módulo automation

## Propósito
Motor de reglas y automatizaciones del bot: disparadores, colas pendientes, límites y monitorización.
Paquete `@superbot/module-automation` (33 ficheros src, 32 tests). Patrón feature-por-fichero, muchas
`partial` (lógica pura sin cablear del todo).

## Ficheros clave (verificado `modules/automation/src`)
- `rule-engine.ts`, `rule-cooldown.ts`, `rule-dedup.ts` — motor de reglas.
- `internal-events.ts`, `event-mode.ts`, `day-phase-rules.ts` — modos y eventos.
- `pending-queue.ts`, `retry-backoff.ts`, `rate-limit-monitor.ts`, `latency-monitor.ts` — colas/resiliencia.
- `rss.ts` — automatización RSS → posts (ver [[Job rss]]).
- `permission-check.ts`, `role-menu-validation.ts`, `plugin-validation.ts`, `orphan-config.ts`,
  `config-*`/`outdated-commands.ts` — validaciones/higiene de config.
- `read-only-mode.ts`, `exam-mode.ts`, `revive-silence.ts`, `alert-presets.ts`, `critical-priority.ts`.

## Superficie
Mini App: [[Controller automation]] (`v1/miniapp/automation`) + `apps/web/app/config/automations/page.tsx`.
Worker: [[Job rss]].

## Cableado
`partial`: gran parte es lógica pura testeada; confirmar cuáles están conectadas a un trigger/UX real.
Ver [[Riesgo Features de lógica pura sin cablear]] y `docs/WIRING-HANDOFF.md`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Produce: [[Job rss]]
- Utilizado por: [[Controller automation]]
- Relacionado con: [[Workflows Map]], [[Integración RSS]]
