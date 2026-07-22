---
id: modryva-support-support-hours
title: Horario de Soporte
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/support-hours.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Horario de Soporte

## Qué hace
Indica si el soporte está dentro de su horario de atención y da un mensaje listo
para enviar. `supportHoursStatus(hourOfDay, options)` usa por defecto una
ventana 9:00–21:00 (configurable) y soporta ventanas nocturnas (open > close,
p. ej. 22 a 6). Fuera de horario, el mensaje invita a dejar consulta y datos de
contacto. `isWithinSupportHours` es el predicado subyacente. Puro y determinista.

## Evidencia
- `modules/support/src/support-hours.ts:76` `supportHoursStatus`;
  `support-hours.ts:52` `isWithinSupportHours`.
- Test: `modules/support/src/support-hours.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:578` (import) y
  `bot-update.service.ts:14871` (`supportHoursStatus(new Date().getHours())`),
  servido por el comando `/horario` dentro de `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuesto como comando `/horario`. La hora se toma en el handler
(`new Date().getHours()`); la ventana por defecto no se ve configurada por chat
en este punto.

## Preguntas abiertas
- ¿Se aplica el horario de forma automática (p. ej. autorespuesta fuera de
  horario), o solo se consulta con el comando? → `unknown`.
- Origen de la configuración de ventana por grupo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Tickets de Soporte]], [[Seguimiento de SLA]]
