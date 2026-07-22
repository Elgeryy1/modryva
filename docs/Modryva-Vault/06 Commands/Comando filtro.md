---
id: modryva-command-filtro
title: Comando filtro
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - docs/COMMANDS.md
tags:
  - modryva
  - command
  - community
  - config
aliases:
  - "/filter"
  - "/filters"
  - "/stop"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /filtro (nativo: /filter)

## Propósito
Respuestas automáticas por palabra-clave. Cuando un mensaje contiene una palabra-filtro (coincidencia por
palabra completa, insensible a mayúsculas), el bot responde con la respuesta asociada.

## Comandos cubiertos
| Comando | `kind` | Efecto |
|---|---|---|
| `/filter <palabra> <respuesta>` | add | Crea un filtro. |
| `/filters` | list | Lista los triggers del chat. |
| `/stop <palabra>` | remove | Elimina un filtro. |

Nota: el comando nativo es `/filter`; `/filtro` es el nombre en español del dominio (resoluble por alias).

## Sintaxis
Ver tabla. El auto-match tiene cooldown de 30s por trigger (`bot-update.service.ts:3641`).

## Permisos
`list` abierto. `add`/`remove` requieren `filters.write` (`ensureConfigPermission`,
`bot-update.service.ts:3565`) — admins.

## Implementación
`handleFiltersCommand` (`apps/bot/src/bot-update.service.ts:3535`) vía `parseFilterCommand`. El disparo
automático lo hace `handleFilterMatch` (3617) con `matchFilter` + `buildTemplateReply`.

## Modelos que toca
[[Modelo Filter]] (`filtersRepository`).

## Eventos
`recordAudit` `filter.saved` (3588) / `filter.removed` (3603).

## Errores / edge-cases
"No hay filtros. Usa /filter..." si vacío. Cooldown evita spam del mismo trigger.

## Tests
`apps/bot/src/bot-update.service.test.ts` + `modules/community/**` (`matchFilter`).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Produce: [[Modelo Filter]]
- Relacionado con: [[Comando config]], [[Comando welcome]]
