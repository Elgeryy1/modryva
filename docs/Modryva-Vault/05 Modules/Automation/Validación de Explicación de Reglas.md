---
id: modryva-automation-validacion-de-explicacion-de-reglas
title: Validación de Explicación de Reglas
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/rule-explanation.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - validateRuleExplanation
created: 2026-07-12
updated: 2026-07-12
---

# Validación de Explicación de Reglas

## Qué hace
Obliga a que cada regla de automatización lleve una justificación humana de por qué existe.
`validateRuleExplanation({ name, explanation })` → `{ valid, issue? }`:

- Inválida (con mensaje en español) si la explicación está vacía, o si su longitud (tras `trim`) es
  menor que `MIN_EXPLANATION_LENGTH = 10` (`rule-explanation.ts:6`, `:46-63`).
- Usa una etiqueta segura del nombre, con fallback `"sin nombre"` cuando el nombre está en blanco
  (`:34-37`). Pura y determinista.

## Evidencia
- `modules/automation/src/rule-explanation.ts:46-64`.
- Cableado en el bot, comando `/validar_explicacion <nombre>|<explicacion>`:
  `apps/bot/src/bot-update.service.ts:16376` (case), `:16381-16384`
  (`validateRuleExplanation({ name, explanation })`), respuesta ✅/⚠️ en `:16385-16389`.
- Import: `apps/bot/src/bot-update.service.ts:118`.
- Tests: `modules/automation/src/rule-explanation.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta desde `/validar_explicacion`, que es **diagnóstico**: el usuario
pega nombre + explicación y el bot dice si pasa la validación. No se observa que el alta de reglas
reales (Prisma `AutomationRule` vía [[Controller automation]]) exija ni almacene este campo
`explanation`, así que hoy la validación no bloquea la creación de una automatización.

## Preguntas abiertas
- ¿El modelo `AutomationRule` tiene un campo de explicación/justificación obligatorio? No se observa
  desde el módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Motor de Reglas]], [[Modelo AutomationRule]], [[Controller automation]]
