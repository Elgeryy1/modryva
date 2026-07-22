---
id: modryva-command-senal_acoso
title: Comando senal_acoso
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
  - "/senal_acoso"
  - "/reaccion_abuso"
  - "/discusion_circular"
  - "/escalada_broma"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /senal_acoso

## Propósito
Señales de conflicto/acoso en el grupo (solo lectura, diagnóstico honesto). No sanciona: informa para que
un humano decida.

## Comandos cubiertos
| Comando | Handler (case) | Qué detecta |
|---|---|---|
| `/senal_acoso` | `bot-update.service.ts:16972` | Dogpiling: varios usuarios respondiendo a la misma persona en 1h (`detectDogpiling`). |
| `/reaccion_abuso` | `bot-update.service.ts:17280` | Oleada de reacciones negativas (👎🤡💩🤮🖕😡) contra alguien en 1h (`detectReactionAbuse`). |
| `/discusion_circular` | `bot-update.service.ts:17322` | Dos personas repitiendo el mismo argumento en bucle (`detectCircularArgument`). |
| `/escalada_broma` | `bot-update.service.ts:17409` | Una broma que deriva en insulto (`detectJokeEscalation`). |

## Sintaxis
Todos sin argumentos, dentro del grupo.

## Permisos
Ninguno especial (cualquier miembro). No requiere bot admin (lee actividad y reacciones ya registradas).

## Implementación
`handleDataReportsCommand` (`apps/bot/src/bot-update.service.ts:16773`). Fuentes:
`listRecent(...,"message")` y `listRecent(...,"reaction",500)`. Descripciones en `apps/bot/src/poller.ts:118`,
`:142`, `:527`, `:543`.

## Modelos que toca
Solo lectura sobre [[Modelo ChatActivity]] (mensajes con `repliedToUserId` y reacciones). No escribe ni audita.

## Eventos
Ninguno (solo lectura).

## Errores / edge-cases
Mensajes tipo "🕊️ Sin señales..." cuando no hay datos suficientes. `/reaccion_abuso` necesita que el bot
capte updates de reacción.

## Tests
`modules/security/**` y `modules/community/**` (detectores puros) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo security]]
- Consume: [[Modelo ChatActivity]]
- Relacionado con: [[Comando copia_pega]], [[Comando tipos_conflicto]], [[Security Map]]
