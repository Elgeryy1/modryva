---
id: modryva-command-top
title: Comando top
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - community
  - gamification
aliases:
  - "/top"
  - "/rep"
  - "/level"
  - "/rank"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /top

## Propósito
Reputación y niveles del grupo. `/top` muestra el ranking (top 10 con puntos, nivel y división); `/rep`
da +1 a otro usuario o muestra la tuya; `/level`/`/rank` muestran tu XP y nivel.

## Comandos cubiertos
| Comando | `kind` | Efecto |
|---|---|---|
| `/top` | `top` | Ranking top 10 (`reputationRepository.top`, con `levelForXp`/`divisionForPoints`). |
| `/rep [id]` | give / show-self | +1 a otro (con anti-farming) o muestra la propia. |
| `/level` `/rank` | level | XP y nivel del que consulta. |

## Sintaxis
`/top` · `/rep` (o `/rep <id>` respondiendo) · `/level` · `/rank`.

## Permisos
Ninguno especial. Reglas de integridad: no puedes darte reputación a ti mismo
(`bot-update.service.ts:3716`) y hay cooldown de 1h por par emisor/receptor vía `floodCounter` (3720).

## Implementación
`handleReputationCommand` (`apps/bot/src/bot-update.service.ts:3663`) vía `parseReputationCommand`. El XP
también se otorga pasivamente por mensaje en `grantActivityXp` (`bot-update.service.ts:7872`, +5 XP máx.
1/min). Distinto de `/topposters` (ese es actividad de mensajes → ver [[Comando stats]]).

## Modelos que toca
[[Modelo ReputationProfile]] (puntos + XP por chat/usuario).

## Eventos
`recordAudit` con `reputation.given` (3741) al dar reputación.

## Errores / edge-cases
"No puedes darte reputación a ti mismo", "Ya diste reputación... recientemente" (cooldown), "Aún no hay
reputación en este chat".

## Tests
`modules/community/**` (reputación, `levelForXp`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Produce: [[Modelo ReputationProfile]]
- Relacionado con: [[Comando novatos]], [[Comando salonfama]], [[Comando confianza]]
