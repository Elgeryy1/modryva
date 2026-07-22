---
id: modryva-command-tipos_conflicto
title: Comando tipos_conflicto
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
  - analytics
aliases:
  - "/tipos_conflicto"
  - "/reglas_rotas"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /tipos_conflicto

## Propósito
Estadística de moderación (solo lectura) a partir de los casos/motivos registrados. `/tipos_conflicto`
tabula los tipos de conflicto más frecuentes; `/reglas_rotas` rankea las normas más rotas.

## Comandos cubiertos
| Comando | Handler (case) | Qué calcula |
|---|---|---|
| `/tipos_conflicto` | `bot-update.service.ts:17426` | `tallyConflictTypes` sobre `moderationRepository.listRecentCases` (por `reason`). |
| `/reglas_rotas` | `bot-update.service.ts:17445` | `rankBrokenRules` sobre los mismos casos (agrupa por `reason`). |

## Sintaxis
Ambos sin argumentos, dentro del grupo.

## Permisos
Ninguno especial (cualquier miembro). Lee casos de moderación ya persistidos; no requiere bot admin.

## Implementación
`handleDataReportsCommand` (`apps/bot/src/bot-update.service.ts:16773`) →
`moderationRepository.listRecentCases(tenantId, chatId)`. Descripciones en `apps/bot/src/poller.ts:547`, `:551`.

## Modelos que toca
Solo lectura sobre [[Modelo ModerationCase]] (campo `reason`). No escribe ni audita.

## Eventos
Ninguno (solo lectura).

## Errores / edge-cases
"Sin casos recientes con motivo registrado" cuando no hay casos con `reason`. Depende de que las sanciones
lleven motivo.

## Tests
`modules/security/**` (`tallyConflictTypes`, `rankBrokenRules`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo security]]
- Consume: [[Modelo ModerationCase]]
- Relacionado con: [[Comando senal_acoso]], [[Comando ban]], [[Security Map]]
