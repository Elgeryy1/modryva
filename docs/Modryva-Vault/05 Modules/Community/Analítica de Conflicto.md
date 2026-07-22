---
id: modryva-community-analitica-conflicto
title: Analítica de Conflicto
type: feature
domain: community
status: implemented
maturity: experimental
source:
  - modules/community/src/dogpiling.ts
  - modules/community/src/reaction-abuse.ts
  - modules/community/src/emerging-topics.ts
  - modules/community/src/crossposting.ts
  - modules/community/src/conflict-types.ts
tags:
  - modryva
  - feature
  - community
aliases: [conflicto, acoso, dogpiling, senales de conflicto, analitica]
created: 2026-07-12
updated: 2026-07-12
---

# Analítica de Conflicto

## Qué hace
Conjunto de detectores puros que leen el log de actividad reciente del grupo y señalan tensión/acoso: acoso grupal a una persona (dogpiling), oleadas de reacciones negativas, crossposting entre temas, temas emergentes/muertos y el reparto de tipos de conflicto en los casos de moderación. Cada uno se consulta con un comando de diagnóstico.

## Evidencia (lógica pura)
- Dogpiling: `detectDogpiling` marca piling con ≥3 atacantes distintos a un target en la ventana (`modules/community/src/dogpiling.ts:15,69-84`).
- Reacciones: `detectReactionAbuse` marca abuso al llegar a 5 reacciones negativas al mismo autor en la ventana (`modules/community/src/reaction-abuse.ts:34,46-83`).
- Temas: `detectEmergingTopics` (min 3 recientes y ≥ previous·factor) y `detectDeadTopics` (`modules/community/src/emerging-topics.ts:19,28-64`).
- Crossposting: `detectCrossposting` detecta el mismo mensaje repetido en varios temas (`modules/community/src/crossposting.ts:53`).
- Tipos de conflicto: `tallyConflictTypes` reparte por `type` con porcentaje (`modules/community/src/conflict-types.ts:28-57`).
- Tests: `dogpiling.test.ts`, `reaction-abuse.test.ts`, `emerging-topics.test.ts`, `crossposting.test.ts`, `conflict-types.test.ts`.

## Estado / cableado
Implemented como comandos de diagnóstico dentro del dispatcher de comunidad (`apps/bot/src/bot-update.service.ts`), que alimentan cada detector desde `chatActivityRepository.listRecent` o `moderationRepository`:
- `senal_acoso` → `detectDogpiling` por cada target (`:17026-17068`).
- `reaccion_abuso` → `detectReactionAbuse` sobre reacciones recientes (`:17334-17375`).
- `crossposting` → `detectCrossposting` sobre mensajes con topic (`:17107-17135`).
- `temas_emergentes` → `detectEmergingTopics` + `detectDeadTopics` en ventanas de 24/48h (`:17137-17198`).
- `tipos_conflicto` → `tallyConflictTypes` sobre casos recientes con motivo (`:17480-17497`).

Nota: `detectCopyPaste` y `detectCircularArgument` (comandos `copia_pega`, `discusion_circular`) son señales relacionadas pero viven en [[Módulo security]], no en community.

## Preguntas abiertas
- Son consultas bajo demanda (comando manual); no se halló que estas señales disparen acción automática (avisar staff, sancionar) → hoy parecen puramente informativas.
- Modelo Prisma exacto tras `chatActivityRepository` (log de mensajes/reacciones) → `unknown` ([[Modelo ChatActivity]] como ghost link).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]], [[Modelo ChatActivity]]
- Relacionado con: [[Mapa de Calor y Participación]], [[Recap Semanal]], [[Ayuda Discreta]]
