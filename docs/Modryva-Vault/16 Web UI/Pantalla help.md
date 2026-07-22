---
id: modryva-pantalla-help
title: Pantalla help
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/help/page.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Guia rapida
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla help

## Qué es
**Guía rápida**: espejo en la Mini App del `/help` nativo del chat (comentado como espejo de `apps/bot/src/core-handlers.ts` `sections`, `page.tsx:3-5`). Mismo contenido, presentado como lista tap-para-expandir en vez de un menú paginado. **No hace ninguna llamada al API** — no necesita contexto de grupo ni auth (`page.tsx:5`).

Contenido:
- "Primeros pasos" (añadir al grupo, dar admin, activar, usar comandos, `page.tsx:151-173`).
- Secciones desplegables (`SECTIONS`, `page.tsx:18-133`): moderación y sanciones, antispam, comunidad y contenido, herramientas de admin, diversión, utilidades, IA y automatización, pagos con Stars. Cada una lista sus comandos.

Estado local `open` para expandir/colapsar una sección a la vez (`page.tsx:136`, `184-190`).

## Ruta y componentes
- Ruta Next real: `/help` (`apps/web/app/help/page.tsx`), client component (`page.tsx:1`).
- Kit UI: `Screen`, `AppHeader`, `Group`, `Row`, `Section` (`page.tsx:8`).
- Solo llama `ready()` del helper de Telegram al montar (`page.tsx:138-140`).

## Datos (API)
- Ninguna. Es contenido estático embebido en el componente.

## Estado
Implementada. Es la única pantalla de la Mini App sin llamadas al API.

## Preguntas abiertas
- El contenido está hardcodeado y debe mantenerse en sync con el `/help` del bot (`apps/bot/src/core-handlers.ts`); si divergen, la guía puede quedar desactualizada — no verificable automáticamente.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Integración Telegram Mini Apps]]
- Relacionado con: [[Pantalla Mini App]], [[Pantalla config]], [[Pantalla federation]]
