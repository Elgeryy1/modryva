---
id: modryva-community-mapa-calor-participacion
title: Mapa de Calor y Participación
type: feature
domain: community
status: implemented
maturity: experimental
source:
  - modules/community/src/activity-heatmap.ts
  - modules/community/src/participation-balance.ts
tags:
  - modryva
  - feature
  - community
aliases: [mapa de calor, heatmap, participacion, gini, monopolio]
created: 2026-07-12
updated: 2026-07-12
---

# Mapa de Calor y Participación

## Qué hace
Dos diagnósticos visuales de actividad, complementarios a [[Activity y Analytics]]:
- Mapa de calor: agrupa los mensajes en 24 cubetas por hora local y lo dibuja con barras Unicode, marcando la hora punta.
- Balance de participación: mide la desigualdad (Gini), detecta a quien acapara la charla y sugiere las voces más calladas.

## Evidencia (lógica pura)
- `buildActivityHeatmap(times, tzOffsetMin)` → array de 24; `peakHour` (hora punta, empate → más temprana); `formatHeatmap` (24 glifos de barra) (`modules/community/src/activity-heatmap.ts:9,30-110`).
- `detectMonopoly(stats, dominanceRatio)` (acapara si share ≥ ratio) y `participationGini(stats)` (coeficiente de Gini 0..1) (`modules/community/src/participation-balance.ts:40-73,82-117`).
- Tests: `activity-heatmap.test.ts`, `participation-balance.test.ts`.

## Estado / cableado
Implemented como comandos del dispatcher de comunidad, leyendo `chatActivityRepository.listRecent`:
- `mapa_calor <tzOffsetMin>` → `buildActivityHeatmap` + `formatHeatmap` + `peakHour` (`apps/bot/src/bot-update.service.ts:16956-16981`).
- `participacion` → `participationGini` (Gini%), `detectMonopoly` (acaparador) y `suggestQuietVoices` (voces calladas) (`bot-update.service.ts:16983-17024`).

## Preguntas abiertas
- `mapa_calor` recibe el offset horario como argumento; no hay zona horaria persistida por grupo → `unknown`.
- Consultas bajo demanda; no se halló publicación periódica automática de estos paneles.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]], [[Modelo ChatActivity]]
- Relacionado con: [[Activity y Analytics]], [[Analítica de Conflicto]], [[Recap Semanal]]
