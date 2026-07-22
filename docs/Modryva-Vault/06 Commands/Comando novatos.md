---
id: modryva-command-novatos
title: Comando novatos
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
  - "/novatos"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /novatos

## Propósito
Separa el ranking de reputación en **novatos** (≤7 días en el grupo) y **veteranos**, para reconocer a los
que empiezan sin que compitan contra los históricos.

## Sintaxis
`/novatos` (sin argumentos, dentro del grupo).

## Permisos
Ninguno especial (cualquier miembro). No requiere bot admin.

## Implementación
`handleRookieRankingCommand` (`apps/bot/src/bot-update.service.ts:3821`; sale si
`command.name !== "novatos"`). Toma el top 20 de `reputationRepository.top`, resuelve la antigüedad con
`getMembershipJoinedAtByTelegramUser` y parte con `separateRookieRanking`. Descripción en
`apps/bot/src/poller.ts:98`.

## Modelos que toca
Solo lectura sobre [[Modelo ReputationProfile]] y la antigüedad de membresía ([[Modelo Membership]]).

## Eventos
Ninguno (solo lectura).

## Errores / edge-cases
"Aún no hay reputación en este chat" o "Aún no hay miembros con antigüedad registrada" (necesita `joinedAt`).

## Tests
`modules/community/**` (`separateRookieRanking`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Consume: [[Modelo ReputationProfile]], [[Modelo Membership]]
- Relacionado con: [[Comando top]], [[Comando salonfama]], [[Comando fantasmas]]
