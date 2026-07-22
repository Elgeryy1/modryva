---
id: modryva-command-salonfama
title: Comando salonfama
type: command
domain: community
status: implemented
maturity: beta
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/poller.ts
tags:
  - modryva
  - command
  - community
  - gamification
aliases:
  - "/salonfama"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /salonfama

## Propósito
Salón de la fama del grupo: ranking por **valor de contribución**, combinando mensajes publicados y
"gracias" recibidas (no solo volumen).

## Sintaxis
`/salonfama` (sin argumentos, dentro del grupo).

## Permisos
Ninguno especial (cualquier miembro). No requiere bot admin.

## Implementación
`handleHallOfFameCommand` (`apps/bot/src/bot-update.service.ts:3892`; sale pronto si
`command.name !== "salonfama"`). Cruza `analyticsRepository.getTopPosters` con
`gratitudeRepository.getPoints` y ordena con `topContributions(contribs, 5)`. Descripción en
`apps/bot/src/poller.ts:102`.

## Modelos que toca
Solo lectura sobre [[Modelo UserActivity]] (top posters) y el repositorio de gratitud
([[Modelo GratitudePoints]] / `gratitudeRepository`).

## Eventos
Ninguno (solo lectura).

## Errores / edge-cases
"Aún no hay actividad registrada en este chat" si no hay posters.

## Tests
`modules/community/**` (`topContributions`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Consume: [[Modelo UserActivity]]
- Relacionado con: [[Comando top]], [[Comando novatos]], [[Comando stats]]
