---
id: modryva-support-missions
title: Misiones e Insignias de Comunidad
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/d1.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Misiones e Insignias de Comunidad

## Qué hace
Misiones de comunidad con insignias (badges) de recompensa, gestionadas desde el
subsistema D1 (`d1.ts`).
- `parseMissionCommand`: `/mission` con subcomandos `list`, `add messages
  <objetivo> <titulo>` (objetivo tope 10 000, la insignia se deriva del título
  vía slug) y `close <id>`; `/missions` (listar) y `/mybadges` (mis insignias).
- Formateadores: `formatMissions`, `formatMissionProgress`, `formatBadges`.
- `buildMissionCompletedText(title, rewardBadge)`: aviso de misión completada +
  badge desbloqueado.

## Evidencia
- `modules/support/src/d1.ts:403` `parseMissionCommand`; `d1.ts:599`
  `formatMissions`; `d1.ts:609` `formatMissionProgress`; `d1.ts:623`
  `formatBadges`; `d1.ts:628` `buildMissionCompletedText`; tipo `MissionCommand`
  en `d1.ts:53`.
- Test: `modules/support/src/d1.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:6817`
  (`parseMissionCommand(update)`) en `handleMissionCommand`; imports de los
  formateadores en `bot-update.service.ts:515,540,541,538`.

## Estado / cableado
`implemented`: cableado a `handleMissionCommand`. El único `goalKind` soportado
es `messages`.

## Preguntas abiertas
- Cómo se cuenta el progreso de mensajes por usuario y dónde se persisten
  misiones/insignias (tabla D1) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Autodiagnóstico del Grupo]]
