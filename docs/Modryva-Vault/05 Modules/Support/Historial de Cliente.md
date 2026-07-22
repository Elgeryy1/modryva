---
id: modryva-support-client-history
title: Historial de Cliente
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/client-history.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Historial de Cliente

## Qué hace
Resume el historial de soporte de un cliente contando sus tickets por estado
(`abierto`, `resuelto`, `cerrado`) y el total. `summarizeClientHistory` es
lógica pura: los tickets con estado no reconocido cuentan solo en `total`, y una
entrada vacía o indefinida devuelve todos los contadores a cero.

## Evidencia
- `modules/support/src/client-history.ts:34` `summarizeClientHistory`; forma del
  resultado en `client-history.ts:21` (`ClientHistorySummary`).
- Test: `modules/support/src/client-history.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:577` (import) y
  `bot-update.service.ts:16947` (`summarizeClientHistory(...)`), servido por el
  comando `/historial_cliente` dentro de `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuesto como comando de utilidad `/historial_cliente`. Es un
resumen de solo lectura; la fuente de los tickets la aporta el handler.

## Preguntas abiertas
- No verificado de dónde toma el handler la lista de tickets del cliente
  (¿[[Modelo Ticket]]?) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Tickets de Soporte]], [[Modelo Ticket]], [[Seguimiento de Tickets Resueltos]]
