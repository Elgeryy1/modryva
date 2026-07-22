---
id: modryva-product-overview
title: Product Overview
type: reference
domain: product
status: implemented
maturity: stable
source:
  - apps/bot/src
  - apps/web
tags:
  - modryva
  - product
aliases:
  - Qué es Modryva
created: 2026-07-12
updated: 2026-07-12
---

# Product Overview — qué es Modryva

**Modryva** (`@ModryvaBot`; paquete interno `superbot`) es un bot de Telegram para **gestionar grupos**, al
estilo GroupHelp/Rose, que además trae **juegos, IA y un casino social**, y funciona como **plataforma
multi-bot** (un bot padre gestiona bots hijos).

## Dos superficies
1. **Chat de Telegram** — comandos ([[Commands Map]]) y moderación automática dentro del grupo.
2. **Mini App web** (Next.js) — panel de configuración y mesa de juegos, autenticada con `initData`
   firmado ([[Pantalla Mini App]], [[ADR-006 Mini App con initData firmado en vez de sesión propia]]). Además,
   configuración inline con `/settings` ([[Comando config]]).

## Pilares (lo que ya funciona)
- **Moderación** — ban/mute/warn/kick, antiflood, antiraid, captcha, filtros, bloqueos de contenido
  ([[Security Map]], [[Sistema de Moderación]]). Con principio de **moderación honesta**: si no puede, lo
  dice; y si el bot no es admin, **se calla** en vez de molestar ([[Companion sin admin]]).
- **Comunidad** — reputación, estadísticas, leaderboard, bienvenidas, sorteos, encuestas, recordatorios,
  juegos cooperativos de grupo ([[Modules Map]], [[Módulo community]]).
- **Juegos** — trivia, tres en raya, RPS y más, portados a la Mini App ([[Módulo games]]).
- **IA** — preguntas con IA, con cuotas y acceso por grupo/usuario ([[Módulo ai]]).
- **Casino social** — fichas **virtuales no canjeables**, provably-fair, con compra por Telegram Stars
  ([[Casino Map]], [[ADR-005 Fichas virtuales no canjeables (guardrail legal)]]).
- **Plataforma multi-bot** — bot padre que crea/gestiona bots hijos ([[Modryva Hub Map]]).

## Estado del producto
Prototipo avanzado, desplegado y en uso; en camino a producto ([[Roadmap Rediseño Total]]). Decisiones de
negocio bloqueadas: nombre de marca, precios, dominio.

## Relaciones
- Pertenece a: [[Product Map]]
- Relacionado con: [[Companion sin admin]], [[Security Map]], [[Casino Map]], [[Modryva Hub Map]], [[Roadmap Map]]
