---
id: welcome
title: Welcome
type: feature
domain: community
status: implemented
maturity: stable
source: [modules/community/src/welcome.ts, modules/community/src/settings.ts, apps/bot/src/bot-update.service.ts, packages/data/prisma/schema.prisma]
tags: [modryva, feature, community]
aliases: [bienvenida, reglas, welcome, rules, goodbye]
created: 2026-07-12
updated: 2026-07-12
---

# Welcome

Mensajes de bienvenida, reglas y despedida configurables por grupo. Parser puro en `modules/community/src/welcome.ts`; persistencia en [[Modelo WelcomeConfig]].

## Comandos

Parser `parseWelcomeCommand` (`welcome.ts:29-77`), handler `welcome.command` (`apps/bot/src/bot-update.service.ts:1333`). Nombres aceptados (`welcome.ts:20-27`):

- `/setwelcome <mensaje>` — fija bienvenida (requiere texto).
- `/welcome` — muestra la bienvenida actual.
- `/resetwelcome` — resetea la bienvenida.
- `/setrules <texto>` — fija reglas.
- `/rules` — muestra las reglas (visibles para miembros; `docs/COMMANDS.md:222`).
- `/setgoodbye <mensaje>` — fija despedida.

## Plantillas

`renderTemplate(template, vars)` (`welcome.ts:83-89`) sustituye placeholders `{clave}`; los desconocidos se reemplazan por cadena vacía para que **nunca se filtren tokens crudos** al usuario. Plantilla por defecto `defaultWelcomeTemplate = "Bienvenido {first_name} a {chat_title}."` (`welcome.ts:91`). Variables soportadas en el panel: `{first_name}`, `{chat_title}` (`settings.ts:165`).

## Panel de ajustes

Desde el [[Settings Panel]]: `renderWelcomePanel` y `renderRulesPanel` (`settings.ts:148-198`) permiten activar/desactivar, cambiar texto y borrar reglas con botones inline.

## Persistencia

Una fila por chat en [[Modelo WelcomeConfig]] (unique `chatId`), con `welcomeText`, `goodbyeText`, `rulesText`.

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo WelcomeConfig]]
- **Utilizado por**: [[Comando welcome]] (`/welcome`), [[Settings Panel]]
- **Relacionado con**: [[Quiet Mode]], [[Commands Map]]
