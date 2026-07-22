---
id: filters
title: Filters
type: feature
domain: community
status: implemented
maturity: stable
source: [modules/community/src/filters.ts, apps/bot/src/bot-update.service.ts, packages/data/prisma/schema.prisma]
tags: [modryva, feature, community]
aliases: [filtros, filter, stop]
created: 2026-07-12
updated: 2026-07-12
---

# Filters

Respuestas automáticas por palabra clave: cuando un mensaje contiene un trigger, el bot responde con el texto asociado. Lógica pura en `modules/community/src/filters.ts`; persistencia en [[Modelo Filter]].

## Comandos de gestión

Parser `parseFilterCommand` (`filters.ts:30-77`), handler `filters.command` (`apps/bot/src/bot-update.service.ts:1328`):

- `/filter <palabra> <respuesta>` — crea un filtro (`docs/COMMANDS.md:130`).
- `/filters` — lista los filtros del chat.
- `/stop <palabra>` — elimina un filtro.

El trigger se normaliza con `normalizeTrigger` (trim + minúsculas, `filters.ts:27-28`).

## Matching ambient

`matchFilter(text, triggers)` (`filters.ts:84-98`) devuelve el primer trigger que aparece como **palabra completa** (case-insensitive) en el texto, respetando el orden de la lista; matchea en límites de palabra, de modo que `"cat"` no matchea `"category"`. Se ejecuta en el handler `filter.ambient` (`bot-update.service.ts:1736`).

## Persistencia

[[Modelo Filter]] con unique `[chatId, trigger]` (un trigger por chat).

## Relaciones

- **Pertenece a**: [[Módulo community]]
- **Depende de**: [[Modelo Filter]]
- **Utilizado por**: [[Comando filter]] (`/filter`)
- **Relacionado con**: [[Custom Commands]], [[Events Map]]
