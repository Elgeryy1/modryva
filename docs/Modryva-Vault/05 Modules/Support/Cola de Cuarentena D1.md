---
id: modryva-support-quarantine
title: Cola de Cuarentena D1
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

# Cola de Cuarentena D1

## Qué hace
Cola de revisión ("modqueue") para mensajes dudosos, parte del subsistema D1
(`d1.ts`). Retiene mensajes sospechosos hasta que un admin los aprueba o
rechaza:
- `parseQuarantineCommand`: `/quarantine [on|off|status|list]`, `/modqueue`,
  `/qapprove <id>`, `/qreject <id> [nota]`.
- `parseQuarantineCallback`: decodifica los botones inline `d1:q:approve:<id>` /
  `d1:q:reject:<id>`.
- `evaluateQuarantineCandidate(content, text, strictness)`: heurística que marca
  para cuarentena por url + palabras sospechosas (airdrop, gratis, promo, wallet,
  crypto, casino...), enlaces de invitación t.me/joinchat, acortadores, reenvíos
  con enlace, y en modo `strict` cualquier enlace o adjunto/animación.
- `buildQuarantineKeyboard`, `buildQuarantineLog`, `formatQuarantineList`:
  teclado inline, línea de log y listado de pendientes.

## Evidencia
- `modules/support/src/d1.ts:205` `parseQuarantineCommand`; `d1.ts:250`
  `parseQuarantineCallback`; `d1.ts:465` `evaluateQuarantineCandidate`;
  `d1.ts:509` `buildQuarantineKeyboard`; `d1.ts:531` `buildQuarantineLog`;
  `d1.ts:565` `formatQuarantineList`.
- Test: `modules/support/src/d1.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:6258`
  (`parseQuarantineCommand(update)`) en `handleQuarantineCommand`, más
  `handleQuarantineCallback` (imports en `bot-update.service.ts:518,519,562`).

## Estado / cableado
`implemented`: cableado a `handleQuarantineCommand` / `handleQuarantineCallback`.
Puente entre soporte y moderación: la cuarentena la dispara el pipeline de
contenido y la resuelve el staff.

## Preguntas abiertas
- La persistencia de los items en cuarentena (tabla D1) y el estado on/off por
  chat se resuelven en `apps/bot` / capa de datos → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Reglas de Automatización]], [[Autodiagnóstico del Grupo]], [[Security Map]], [[Flujo Ban]]
