---
id: modryva-automation-eventos-internos
title: Eventos Internos
type: feature
domain: automation
status: partial
maturity: experimental
source:
  - modules/automation/src/internal-events.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - INTERNAL_EVENT_TYPES
  - buildInternalEvent
  - signInternalEvent
created: 2026-07-12
updated: 2026-07-12
---

# Eventos Internos

## Qué hace
Catálogo y construcción de los **eventos internos del superbot**, pensados como base estructural para
integraciones y plugins de terceros (el contrato de eventos que los triggers podrían consumir). Lógica
pura: describe, construye, serializa y firma eventos a partir de inputs planos; no emite nada ni toca
red/reloj (`internal-events.ts:1-9`).

- `INTERNAL_EVENT_TYPES` (orden estable = contrato público): `user_joined`, `case_created`,
  `rule_triggered`, `sanction_applied`, `appeal_opened`, `member_left` (`:15-22`).
- `isInternalEventType(type)` type-guard sobre el catálogo (`:39-40`).
- `buildInternalEvent(type, payload, ts)` → resultado discriminado `ok`/`error`. Falla con
  `unknown-type` si el tipo no está en el catálogo, o `invalid-timestamp` si `ts` no es entero finito
  ≥ 0; copia el payload superficialmente para no compartir la referencia mutable (`:45-89`).
- `serializeInternalEvent(event)` produce JSON canónico con claves ordenadas alfabéticamente (incluidas
  las anidadas) para firmas reproducibles (`:96-124`).
- `signInternalEvent(serialized, secret, hasher)` delega la firma en un hasher inyectado (p. ej.
  HMAC-SHA256 del servicio) para no depender de `crypto` (`:126-136`).

## Evidencia
- `modules/automation/src/internal-events.ts:15-136`.
- Exportado en `modules/automation/src/index.ts:9`.
- Tests: `modules/automation/src/internal-events.test.ts`.
- Invocación en `apps/`: **0 resultados** para `buildInternalEvent` / `INTERNAL_EVENT_TYPES` /
  `signInternalEvent` → no cableado.

## Estado / cableado
`partial`. Define el vocabulario de eventos que serían los **triggers** del motor de reglas, pero
ninguna app emite ni consume estos eventos. Es la contraparte teórica de los triggers reales que sí
usa el bot (`report`, `new_member`, `contains_text`… en el modelo `AutomationRule`, ver
[[Controller automation]]), pero por otra vía y sin conectar.

## Preguntas abiertas
- ¿Qué componente emitiría `rule_triggered` / `sanction_applied` y con qué `hasher` se firmarían? No
  observable desde el módulo → `unknown`.
- Relación exacta con los `AutomationTrigger` del modelo real (¿unificar catálogos?) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Motor de Reglas]], [[Modelo AutomationRule]], [[Controller automation]],
  [[Webhooks Salientes]]
