---
id: modryva-community-hitos-miembros
title: Hitos de Miembros
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/milestones.ts
tags:
  - modryva
  - feature
  - community
aliases: [milestones, hitos, celebracion de miembros]
created: 2026-07-12
updated: 2026-07-12
---

# Hitos de Miembros

## Qué hace
Celebra automáticamente cuando el grupo cruza un hito de miembros (100, 500, 1000, 5000, 10000) al entrar gente nueva, con un mensaje festivo y el conteo formateado en estilo es-ES ("1.000").

## Evidencia
- `MEMBER_MILESTONES = [100, 500, 1000, 5000, 10000]` (`modules/community/src/milestones.ts:11-13`).
- `crossedMilestone(before, after)` devuelve el hito cruzado o null (solo con crecimiento) (`milestones.ts:21-41`).
- `formatMilestone(members)` genera el anuncio con separador de millares (`milestones.ts:48-59`).
- Test: `modules/community/src/milestones.test.ts`.

## Estado / cableado
Implemented (evento, sin comando). `celebrateMilestone` corre al procesar altas: `after = countActiveMemberships`, `before = after - newChatMemberIds.length`, y si `crossedMilestone` no es null envía `formatMilestone` por el gateway (`apps/bot/src/bot-update.service.ts:13998-14024`). Sin almacenamiento nuevo (el propio comentario del código lo indica en `:13998-14002`). Imports en `bot-update.service.ts:163,193`.

## Preguntas abiertas
- Ninguna relevante: el disparo, los umbrales y el render están verificados.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Welcome]], [[Álbum de Temporada]]
