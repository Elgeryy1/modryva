---
id: modryva-command-casino
title: Comando casino
type: command
domain: casino
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - casino
aliases:
  - "/casino"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /casino

## Propósito
Punto de entrada al casino social. Muestra una tarjeta mínima ("🎰 Casino Modryva") con un botón que abre
el **lobby** del casino en la Mini App.

## Sintaxis
`/casino` (grupo o privado). En grupo abre por deep-link `startapp=casino`; en privado por `web_app` a
`/casino`. Ver [[Casino Map]].

## Permisos
Ninguno especial (abierto a miembros). La economía es por (tenant, usuario) → [[Modelo ChipWallet]].

## Implementación
`handleCasinoCommand` en `apps/bot/src/bot-update.service.ts`, en la cadena de dispatch **antes** de
`handleFunCommand` (para no chocar con los `/dice`/`/slots` nativos). Enruta a la Mini App servida por
[[App web]] (`apps/web/app/casino/page.tsx`).

## Comandos hermanos del casino
`/cartera` `/wallet` `/saldo` `/fichas`, `/bono` `/daily`, `/dado` `/apostar`, `/duelo`, `/regalar`,
`/comprar` `/tienda`, `/nivel` `/vip`, `/cashback`, `/rescate`, `/verificar`. Ver [[Chip Economy]].

## Efectos
No debita nada por sí mismo (solo abre UI). Las apuestas van por [[Servicio casino]] → [[Casino Bet Lifecycle]].

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[App web]]
- Relacionado con: [[Casino Map]], [[Módulo games]], [[Servicio casino]], [[Chip Economy]]
