---
id: modryva-flujo-onboarding-grupo
title: Flujo Onboarding de grupo
type: flow
domain: core
status: implemented
maturity: stable
source:
  - modules/core
  - apps/bot/src
tags:
  - modryva
  - flow
  - core
aliases:
  - Flujo alta de grupo
  - Bot añadido a un grupo
created: 2026-07-12
updated: 2026-07-12
---

# Flujo — el bot es añadido a un grupo (onboarding)

## Disparador
Alguien añade el bot a un grupo → llega un [[Evento my_chat_member]] (cambia el estado del **propio bot**
en ese chat).

## Pasos
1. **Detección**: el dispatcher reconoce el `my_chat_member` y comprueba si el bot pasó a `member`/
   `administrator` en un chat nuevo.
2. **Alta de tenant**: se crea/asegura el registro del grupo y su [[Modelo ChatSetting]] con valores por
   defecto (config inicial).
3. **Chequeo de permisos**: se evalúa si el bot es **admin** o no:
   - **Admin** → mensaje de bienvenida con el **título real** del grupo y guía de configuración
     (enlace a la [[App web|Mini App]] con el `gid` del grupo).
   - **No admin** → onboarding *companion*: explica qué puede hacer sin permisos y cómo ascenderlo, sin
     prometer moderación que no podrá ejecutar.
4. **Config inicial**: se ofrece abrir el panel ([[App web]]) o `/settings` inline para ajustar módulos.

## Ramas y fallos
- **Reañadido** (ya existía config) → no se pisan ajustes previos; se saluda de vuelta.
- **Modo silencio / bot degradado** → se minimiza el mensaje de bienvenida.
- **onboarding con `gid`**: el enlace a la Mini App debe llevar el grupo en la query y validar
  `botIsAdmin` (bug histórico ya corregido).

## Estado observable
Existencia del `ChatSetting` del grupo; `activity-log` del alta; logs del bot.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Disparado por: [[Evento my_chat_member]]
- Depende de: [[Módulo core]], [[Modelo ChatSetting]], [[App web]]
- Relacionado con: [[Flujo Update de Telegram]], [[Modryva Hub Map]]
