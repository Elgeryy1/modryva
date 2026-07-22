---
id: modryva-command-reglas
title: Comando reglas
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - modules/community/src/welcome.ts
tags:
  - modryva
  - command
  - community
aliases:
  - "/rules"
  - "/reglas"
  - "/setrules"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /reglas (nativo: /rules)

## Propósito
Muestra las reglas del grupo. El comando **nativo** es `/rules` (`show-rules`); `/setrules` las define.
`/reglas` funciona a través del sistema de alias (mapea a `rules`).

## Comandos cubiertos
| Comando | `kind` | Efecto |
|---|---|---|
| `/rules` | show-rules | Muestra `rulesText`; suma gamificación `read_rules`. |
| `/setrules <texto>` | set-rules | Define las reglas (requiere permiso). |

Nombres nativos aceptados por el parser: `setwelcome, welcome, resetwelcome, setrules, rules`
(`modules/community/src/welcome.ts:20-25`). `/reglas` **no** es nativo: se resuelve por
`resolveCommandAlias` del módulo de alias (ver [[Comando config]] / command_alias).

## Sintaxis
`/rules` (o `/reglas`) para ver · `/setrules <texto>` para definir.

## Permisos
Ver reglas: abierto. `/setrules`: `welcome.config` (`ensureConfigPermission`, `bot-update.service.ts:13739`)
— admins. No requiere bot admin de Telegram.

## Implementación
`handleWelcomeCommand` (`apps/bot/src/bot-update.service.ts:13697`) vía `parseWelcomeCommand`. En `show-rules`
llama a `progressGamification(...,"read_rules")` (13727).

## Modelos que toca
[[Modelo WelcomeConfig]] (campo `rulesText`).

## Eventos
`recordAudit` `welcome.config.updated` al escribir (13769).

## Errores / edge-cases
"No hay reglas configuradas. Usa /setrules..." si están vacías. Fuera de grupo pide usarlo en un grupo.

## Tests
`modules/community/src/welcome.ts` (tests del parser) + `apps/bot/src/bot-update.service.test.ts`.

## Open Questions
- `/reglas` depende de que exista un alias configurado o un default; confirmar el mapa de alias por defecto.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo community]]
- Produce: [[Modelo WelcomeConfig]]
- Relacionado con: [[Comando welcome]], [[Comando config]]
