---
id: modryva-command-copia_pega
title: Comando copia_pega
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
  - antispam
aliases:
  - "/copia_pega"
  - "/spam_firma"
  - "/spam_saludo"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /copia_pega

## Propósito
Detectores de patrones de spam en el grupo (solo lectura). Informan; no borran ni sancionan por sí mismos.

## Comandos cubiertos
| Comando | Handler (case) | Qué detecta |
|---|---|---|
| `/copia_pega` | `bot-update.service.ts:17342` | Mismo texto copipasteado por varias cuentas (`detectCopyPaste`, clusters). |
| `/spam_firma` | `bot-update.service.ts:17016` | Un usuario repitiendo la misma "firma" en sus mensajes (`detectSignatureSpam`). |
| `/spam_saludo` | `bot-update.service.ts:17367` | Patrón saludo seguido de enlace (`detectGreetingSpam`). |

## Sintaxis
Todos sin argumentos, dentro del grupo.

## Permisos
Ninguno especial (cualquier miembro). No requiere bot admin (lee el log de mensajes).

## Implementación
`handleDataReportsCommand` (`apps/bot/src/bot-update.service.ts:16773`), sobre
`chatActivityRepository.listRecent(...,"message")`. Nota: la eliminación real de spam la hacen otros
subsistemas (blocklist, antiflood, locks); estos comandos son diagnóstico. Descripciones en
`apps/bot/src/poller.ts:122`, `:531`, `:535`.

## Modelos que toca
Solo lectura sobre [[Modelo ChatActivity]]. No escribe ni audita.

## Eventos
Ninguno (solo lectura).

## Errores / edge-cases
"Sin ... detectado" cuando no hay coincidencias. `/spam_saludo` usa el flag `hasLink` del log.

## Tests
`modules/security/**` (detectores puros) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo security]]
- Consume: [[Modelo ChatActivity]]
- Relacionado con: [[Comando senal_acoso]], [[Comando antiflood_on]], [[Security Map]]
