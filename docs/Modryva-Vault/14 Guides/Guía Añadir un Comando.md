---
id: modryva-guia-anadir-comando
title: Guía Añadir un Comando
type: guide
domain: developer
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - apps/bot/src/poller.ts
tags:
  - modryva
  - guide
  - developer
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Guía — añadir un comando al bot

Un comando nuevo necesita **tres puntos de contacto** coordinados. Olvidar uno es el error típico: la
lógica existe pero el comando "no hace nada" (parser sin handler) o no aparece en el menú (handler sin
registro).

## 1) Lógica de dominio (módulo) — un parser puro
Sigue [[ADR-004 Lógica de dominio pura y testeable por fichero]]: crea la lógica en el módulo que
corresponda (`modules/<dominio>/src/x.ts`) con su hermano `x.test.ts`. Para comandos, suele haber un
`parseXCommand(update)` que devuelve un plan tipado o `null` si el texto no es ese comando (patrón de
`parseModerationCommand`, `parseWelcomeCommand`…).

## 2) Handler en el dispatcher del bot
En `apps/bot/src/bot-update.service.ts`, añade tu handler a la **cadena** `botHandlers()`
(≈ `bot-update.service.ts:1096`+). Cada entrada es `{ name, handle }` y el handler devuelve `BotReply | null`.
**`null` = "no es lo mío, sigue al siguiente"**; la cadena devuelve la primera respuesta no nula
(`bot-update.service.ts:1087-1093`). No hay fallback de "comando desconocido", así que devolver `null`
significa silencio.
```ts
{
  name: "mifeature.command",
  handle: ({ context, update }) => this.handleMiFeatureCommand(context, update),
},
```
El handler: parsea (paso 1), valida permisos (`isActorAdmin` / `evaluatePolicy`), ejecuta la lógica, escribe
en [[Package data]], registra auditoría (`recordAudit`) y devuelve el `BotReply`.

## 3) Registro del comando (menú + descripción)
Añade el comando al registro canónico en `apps/bot/src/poller.ts` (lista de comandos con descripción) para
que aparezca en el menú de Telegram (`setMyCommands`) y en [[Comando help]].

## Checklist
- [ ] `parseXCommand` + test en el módulo.
- [ ] Handler en `botHandlers()` (orden importa: colócalo donde no lo "coma" otro handler).
- [ ] Entrada en `poller.ts`.
- [ ] Nota en el Vault: `Comando <x>` (ver [[Conventions]]).
- [ ] ¿Requiere que el bot sea admin? Recuerda el patrón de silencio para bots sin admin (`botConfirmedNotAdmin`).

## Preguntas abiertas
- Sistema de **alias** de comandos (`command_alias` / `resolveCommandAlias`): cómo se registran alias por
  defecto vs. por admin — ver [[Open Questions]] #17.

## Relaciones
- Pertenece a: [[Developer Onboarding Map]]
- Depende de: [[Bot Update Service]], [[Commands Map]]
- Relacionado con: [[Flujo Update de Telegram]], [[ADR-004 Lógica de dominio pura y testeable por fichero]], [[Guía Añadir un Módulo]]
