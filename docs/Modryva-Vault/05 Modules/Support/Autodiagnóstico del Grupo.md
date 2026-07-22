---
id: modryva-support-doctor
title: Autodiagnóstico del Grupo
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/d1.ts
tags:
  - modryva
  - feature
  - support
aliases:
  - Doctor del Grupo
created: 2026-07-12
updated: 2026-07-12
---

# Autodiagnóstico del Grupo

## Qué hace
Comando "doctor" que puntúa la salud de configuración de un grupo sobre 100 y
recomienda ajustes. `buildDoctorReport(input)` parte de 100 y resta por cada
protección desactivada: antiflood (-15), captcha/welcome-mute (-15), antiraid
(-10), logs (-10), cuarentena (-10), cuarentena pendiente > 5 (-10); además
añade recomendaciones sobre apelaciones abiertas, automatizaciones y misiones.
`isDoctorCommand` reconoce `/diagnose` y `/doctor`. También expone el canal de
logs D1 (`parseD1LogCommand`, `formatEvents`) para `/logs` / `/logchannel`.

## Evidencia
- `modules/support/src/d1.ts:322` `isDoctorCommand`; `d1.ts:633`
  `buildDoctorReport`; `d1.ts:163` `parseD1LogCommand`; `d1.ts:556`
  `formatEvents`; forma `DoctorInput` en `d1.ts:130`.
- Test: `modules/support/src/d1.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:6530` (`isDoctorCommand`) y
  `bot-update.service.ts:6565` (`buildDoctorReport({...})`) en
  `handleD1DoctorCommand`; `parseD1LogCommand` importado en
  `bot-update.service.ts:557` (`handleD1LogsCommand`).

## Estado / cableado
`implemented`: cableado a `handleD1DoctorCommand` (y `handleD1LogsCommand` para
los logs). El informe agrega el estado real de las protecciones del chat que el
handler recopila.

## Preguntas abiertas
- No verificado de qué módulos toma el handler cada flag (`antifloodEnabled`,
  `captchaEnabled`, etc.) para poblar `DoctorInput` → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Cola de Cuarentena D1]], [[Reglas de Automatización]], [[Misiones e Insignias de Comunidad]], [[Security Map]]
