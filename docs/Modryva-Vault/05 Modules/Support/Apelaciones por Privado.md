---
id: modryva-support-appeals
title: Apelaciones por Privado
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
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Apelaciones por Privado

## Qué hace
Flujo de apelación de sanciones dentro del subsistema D1 (`d1.ts`): un usuario
sancionado apela por privado y el staff acepta o deniega desde un canal/grupo.
- `parseAppealCommand`: `/appeal <caso|sancion> <texto>` (crear), `/appeals`
  (listar), `/appeal_accept <id> [nota]`, `/appeal_deny <id> [nota]`.
- `parseAppealCallback`: decodifica los botones inline `d1:a:accept:<id>` /
  `d1:a:deny:<id>`.
- `buildAppealKeyboard`, `buildAppealLog`, `formatAppeals`: teclado inline de
  aceptar/denegar, línea de log de apelación nueva y listado de apelaciones
  abiertas.

Esta es la superficie cableada del ciclo de apelación; las notas
[[Clasificación de Apelaciones]], [[ETA de Apelaciones]],
[[Contexto de Apelación para Staff]], [[Apelaciones Delicadas]] y
[[Analítica de Apelaciones]] documentan capacidades auxiliares (comandos de
utilidad) alrededor de este flujo.

## Evidencia
- `modules/support/src/d1.ts:263` `parseAppealCommand`; `d1.ts:312`
  `parseAppealCallback`; `d1.ts:520` `buildAppealKeyboard`; `d1.ts:543`
  `buildAppealLog`; `d1.ts:577` `formatAppeals`; tipo `AppealCommand` en
  `d1.ts:24`.
- Test: `modules/support/src/d1.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:6406`
  (`parseAppealCommand(update)`) en `handleAppealCommand`, más
  `handleAppealCallback` (imports `parseAppealCallback` en
  `bot-update.service.ts:554`, `buildAppealKeyboard` en `:508`).

## Estado / cableado
`implemented`: cableado a `handleAppealCommand` / `handleAppealCallback`. La
apelación por privado se conecta con moderación ([[Flujo Ban]] →
[[Flujo Apelación]]).

## Preguntas abiertas
- Persistencia de apelaciones y su estado (tabla D1) fuera de este módulo →
  `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Modelo Appeal]], [[Flujo Apelación]], [[Clasificación de Apelaciones]], [[Cola de Cuarentena D1]]
