---
id: modryva-pantalla-config
title: Pantalla config
type: screen
domain: web
status: implemented
maturity: stable
source:
  - apps/web/app/config/page.tsx
tags:
  - modryva
  - screen
  - web
aliases:
  - Pantalla settings
  - Menu de configuracion
created: 2026-07-12
updated: 2026-07-12
---

# Pantalla config

## Qué es
Es el **menú de configuración de un grupo**: una lista de secciones agrupadas por cómo piensa un admin (Propietario, Comunidad, Moderación, Sanciones) más una entrada "Empieza aquí" hacia el onboarding (`page.tsx:365-380`). Cada fila navega a la subpantalla correspondiente pasando `?gid=<gid>` (`page.tsx:337-351`).

El grupo llega de dos formas (`page.tsx:271-285`): deep link `cfg_<gid>` (`start_param`) o `?gid=` en la query (así se aterriza tras el paso "moderar" del onboarding). Si no hay `gid` muestra el estado `no-group` con instrucciones (`page.tsx:315-326`).

Grupos de secciones definidos como metadatos:
- `OWNER` (`page.tsx:42-131`): network, moderation-inbox, wizard, risk, analytics, gamification, users, automations, backup, premium, ai-pack.
- `COMMUNITY` (`page.tsx:134-173`): welcome, rules, rituals, quiet, recap.
- `MODERATION` (`page.tsx:174-241`): flood, raid, captcha, locks, hygiene, membershipGate, federation, filters, schedule-rules.
- `SANCTIONS` (`page.tsx:243-259`): warns, blocklist.

Las secciones con `href` propio van a su ruta estática; las que no lo tienen usan la ruta dinámica `/config/<id>` (`page.tsx:337-351`), servida por [[Pantalla config-section]].

## Ruta y componentes
- Ruta Next real: `/config` (`apps/web/app/config/page.tsx`), client component envuelto en `<Suspense>` (`page.tsx:385-398`).
- Kit UI: `Screen`, `AppHeader`, `Section`, `Group`, `Row`, `Empty`, `Banner`, `SkeletonList` (`page.tsx:6-16`).
- Mapea códigos de error del API a mensajes humanos (`not-admin`, `chat-not-found`, `page.tsx:22-29`).

## Datos (API)
- `postSession(startParam)` → `POST /v1/miniapp/session` (para resolver título del grupo y nombre del bot, `page.tsx:286-297`). Ver `[[Endpoint POST v1 miniapp session]]`.
- El resto de las llamadas las hacen las subpantallas destino. Ver `[[Controller config]]`.

## Estado
Implementada y cableada: es el hub central desde el que cuelgan casi todas las subpantallas de `/config/*`. Título dinámico con `botName`/`title` del grupo (`page.tsx:355-364`).

## Preguntas abiertas
- (ninguna relevante; el mapeo de secciones está todo en el fichero)

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[App web]], [[Integración Telegram Mini Apps]], [[Guard InitData]]
- Relacionado con: [[Pantalla config-section]], [[Pantalla onboarding]], [[Pantalla network]], [[Pantalla moderation]], [[Pantalla wizard]], [[Pantalla risk]], [[Pantalla analytics]], [[Pantalla gamification]], [[Pantalla users]], [[Pantalla automations]], [[Pantalla backup]], [[Pantalla premium]], [[Pantalla ai-pack]], [[Pantalla federation]], [[Pantalla listas]], [[Pantalla ajustes ligeros]], [[Controller config]]
