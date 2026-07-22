---
id: modryva-command-historial_apelaciones
title: Comando historial_apelaciones
type: command
domain: moderation
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/poller.ts
tags:
  - modryva
  - command
  - moderation
  - appeals
aliases:
  - "/historial_apelaciones"
  - "/informe_apelaciones_aceptadas"
  - "/apelaciones_por_incidente"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /historial_apelaciones

## Propósito
Informes sobre las **apelaciones** (D1 / Control Center) del grupo, solo lectura. Resumen agregado de cómo
se están resolviendo las apelaciones.

## Comandos cubiertos
| Comando | Handler (case) | Qué calcula |
|---|---|---|
| `/historial_apelaciones` | `bot-update.service.ts:16802` | `summarizeAppealHistory`: total, aceptadas, rechazadas, tasa. |
| `/informe_apelaciones_aceptadas` | `bot-update.service.ts:16784` | `summarizeAcceptedAppeals`: aceptadas agrupadas por regla (`caseRef`). |
| `/apelaciones_por_incidente` | `bot-update.service.ts:16816` | `bucketAppealsByIncident`: agrupa apelaciones por incidente + IDs. |

## Sintaxis
Todos sin argumentos, dentro del grupo.

## Permisos
Ninguno especial en el código de estos casos (a diferencia de `/appeals` y `/appeal_accept`, que sí gatean
por `config.write`). Leen apelaciones ya registradas.

## Implementación
`handleDataReportsCommand` (`apps/bot/src/bot-update.service.ts:16773`) →
`d1Repository.listAppeals(tenantId, chatId)`. Descripciones en `apps/bot/src/poller.ts:507`, `:510`, `:514`.

## Modelos que toca
Solo lectura sobre [[Modelo D1Appeal]]. No escribe ni audita.

## Eventos
Ninguno (solo lectura).

## Errores / edge-cases
"Sin apelaciones registradas" cuando no hay filas. El sistema de apelaciones vive en el módulo D1
(`/appeal`, `/appeals`, `/appeal_accept`, `/appeal_deny`).

## Tests
`apps/bot/src/bot-update.service.test.ts` + funciones puras de resumen en el módulo D1/community.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo D1]]
- Consume: [[Modelo D1Appeal]]
- Relacionado con: [[Comando ban]], [[Security Map]]
