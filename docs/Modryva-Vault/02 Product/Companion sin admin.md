---
id: modryva-product-companion-sin-admin
title: Companion sin admin
type: reference
domain: product
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - product
  - security
aliases:
  - Modo companion
  - Bot solo para juegos
created: 2026-07-12
updated: 2026-07-12
---

# Companion sin admin — Modryva cuando NO es administrador

Una decisión de producto clave: si añaden a Modryva a un grupo **sin darle permisos de administrador**, no se
comporta como un moderador roto que se queja, sino como un **compañero útil** que hace lo que sí puede.

## Qué SÍ hace sin ser admin
- 🎮 **Juegos y trivia** — [[Comando jugar]], [[Comando trivia]] ([[Módulo games]]).
- 🤖 **IA** — preguntas con IA ([[Módulo ai]]).
- 📊 **Encuestas y sorteos** — [[Comando poll]], [[Comando giveaway]].
- ⏰ **Recordatorios** — [[Comando recordar]].
- 🗓️ **Recap semanal** del grupo si se activa ([[Flujo Recap Semanal]]).
- 🛡 **Aviso de estafas/malware** — si ve un mensaje peligroso, **avisa** (no puede borrarlo sin ser admin) —
  patrón "watchdog" (`deleteOrWatch`).

## Qué hace en vez de moderar
- **Onboarding companion**: al entrar sin permisos, la tarjeta de bienvenida lidera con lo que puede hacer y
  cierra con **una** invitación calmada a hacerlo admin (no promete moderación que no podrá cumplir).
- **Silencio en comandos de moderación** *(desplegado 2026-07)*: si alguien usa `/warn` `/ban` `/mute`
  `/kick` y el bot **no es admin**, **no responde nada** — ni "me faltan permisos" ni nag. Implementado con
  `botConfirmedNotAdmin` (`bot-update.service.ts`): solo se calla cuando está **confirmado** que no es admin;
  ante la duda, cae al comportamiento honesto de siempre. Ver [[Flujo Ban]], [[Flujo Mute]].

## Gate transversal
El **modo silencio** (`isChatQuiet`) es el gate universal de mensajes no pedidos: incluso las funciones que
sí puede hacer respetan que un admin lo haya silenciado.

## Por qué importa (producto)
Deja que el bot entre "solo para los juegos" sin fricción, y convierte la falta de permisos en una invitación
suave a promoverlo — en vez de spamear errores que el usuario no puede resolver.

## Relaciones
- Pertenece a: [[Product Map]]
- Depende de: [[Bot Update Service]], [[Módulo security]]
- Relacionado con: [[Product Overview]], [[Flujo Onboarding de grupo]], [[Flujo Ban]], [[Flujo Mute]]
