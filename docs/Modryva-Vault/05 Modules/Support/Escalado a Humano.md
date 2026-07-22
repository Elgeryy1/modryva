---
id: modryva-support-human-escalation
title: Escalado a Humano
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/human-escalation.ts
  - modules/support/src/bot-error-escalation.ts
  - modules/support/src/inactive-admin-escalation.ts
tags:
  - modryva
  - feature
  - support
aliases:
  - Escalado por Owner Inactivo
  - Escalado de Errores del Bot
created: 2026-07-12
updated: 2026-07-12
---

# Escalado a Humano

## Qué hace
Tres reglas de decisión que deciden cuándo pasar un caso de las manos del bot a
un humano:
- `decideHumanEscalation({ severity, botConfidence }, options)`: escala si la
  gravedad supera el máximo para el bot (por defecto 3) o si la confianza cae por
  debajo del mínimo (por defecto 0.6), con razón en español según el disparador.
- `shouldEscalateBotError({ botConfidence, userDisputes, autoActioned })`:
  posible error del bot; escala solo si el bot auto-actuó, el usuario lo disputa
  y la confianza fue < 0.7.
- `shouldEscalateToOwner({ alertMs, nowMs, lastAdminResponseMs })`: escala una
  alerta crítica al owner si ningún admin respondió tras ella y lleva abierta al
  menos el umbral (por defecto 15 min); `formatEscalationNotice` arma el aviso.

## Evidencia
- `modules/support/src/human-escalation.ts:43` `decideHumanEscalation`.
- `modules/support/src/bot-error-escalation.ts:34` `shouldEscalateBotError`.
- `modules/support/src/inactive-admin-escalation.ts:48` `shouldEscalateToOwner`;
  `inactive-admin-escalation.ts:66` `formatEscalationNotice`.
- Tests: `human-escalation.test.ts`, `bot-error-escalation.test.ts`,
  `inactive-admin-escalation.test.ts`.
- Cableado (comandos de `handleUtilityPlusCommand`):
  `apps/bot/src/bot-update.service.ts:15564` (`decideHumanEscalation` →
  `/escalar_humano`), `bot-update.service.ts:15169` (`shouldEscalateBotError` →
  `/error_bot`), `bot-update.service.ts:15655` (`shouldEscalateToOwner` →
  `/escalar_owner`).

## Estado / cableado
`implemented`: las tres reglas se exponen como comandos de utilidad/diagnóstico.
Son decisiones puras; el escalado por inactividad de admin depende de reloj y
`lastAdminResponseMs` inyectados. No se verificó que exista un job que evalúe
`shouldEscalateToOwner` de forma continua.

## Preguntas abiertas
- ¿El escalado por owner inactivo se dispara desde un scheduler o solo bajo el
  comando? → `unknown`.
- Origen de `severity`/`botConfidence` y de las alertas críticas en el handler →
  `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Apelaciones Delicadas]], [[Incidencias y Mediación Asíncrona]], [[Seguimiento de SLA]]
