---
id: modryva-support-incident-mediation
title: Incidencias y Mediación Asíncrona
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/incident-status.ts
  - modules/support/src/async-mediation.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Incidencias y Mediación Asíncrona

## Qué hace
Dos máquinas de estado puras:
- Incidencias (`nextIncidentStatus(current, event)`): estados `abierto`,
  `esperando`, `resuelto`, `cerrado` con eventos `responder`, `pedir_info`,
  `resolver`, `cerrar`, `reabrir`. Un evento inválido para el estado actual no
  cambia nada (`changed=false`).
- Mediación asíncrona (`nextMediationStep(current, event)`): cada parte escribe
  su versión en privado sin discusión pública; estados `abierta`,
  `esperando_a`, `esperando_b`, `lista_revision`, `cerrada` con eventos
  `version_a`, `version_b`, `revisar`, `cerrar`. Ambas versiones deben llegar
  antes de `lista_revision`. `mediationStateLabel` da etiquetas en español.

## Evidencia
- `modules/support/src/incident-status.ts:66` `nextIncidentStatus`; tabla en
  `incident-status.ts:33`.
- `modules/support/src/async-mediation.ts:66` `nextMediationStep`;
  `async-mediation.ts:80` `mediationStateLabel`.
- Tests: `incident-status.test.ts`, `async-mediation.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:15691`
  (`nextIncidentStatus(...)` → `/estado_incidencia`) y
  `bot-update.service.ts:15111` (`nextMediationStep(...)` → `/mediacion`), en
  `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: ambas máquinas de estado se exponen como comandos
`/estado_incidencia` y `/mediacion`. Lógica pura; la persistencia del estado
actual la lleva el handler.

## Preguntas abiertas
- Dónde se persiste el estado de incidencias/mediaciones entre eventos →
  `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Escalado a Humano]], [[Tickets de Soporte]]
