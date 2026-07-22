---
id: moc-hub
title: Modryva Hub Map
type: moc
domain: platform
status: partial
maturity: beta
tags:
  - modryva
  - moc
  - platform
  - hub
created: 2026-07-12
updated: 2026-07-12
---

# Modryva Hub Map

La **plataforma multi-bot** tipo GroupHelp: un bot padre (`@ModryvaBot`) concede acceso y crea/gestiona
bots hijos ("managed bots"), con roles de plataforma y entitlements. Parte la mantiene "Codex" en paralelo.
Hub: [[Modryva Hub Overview]]. Notas en `11 Modryva Hub/`.

## Piezas

- [[Managed Bots]] — ciclo de vida, cifrado de token (`MANAGED_BOT_TOKEN_KEY`), webhook por túnel Cloudflare.
- [[Platform Roles y RBAC]] — [[Enum PlatformRole]], [[Modelo PlatformRoleAssignment]].
- [[Promo Codes y Entitlements]] — [[Modelo PromoCode]] → [[Modelo PromoRedemption]] → [[Modelo Entitlement]].
- [[Platform User Ban]] — baneo a nivel plataforma ([[Modelo PlatformUserBan]]).
- [[Bot Scoping]] — resolver update → bot/tenant correcto.
- [[Webhook de Bots Hijos]] — [[Controller telegram-webhook]] + verificación de secreto.

## Datos

[[Modelo Tenant]] · [[Modelo ManagedBot]] · [[Modelo Entitlement]] · [[Enum ManagedBotStatus]] ·
[[Enum ManagedBotTemplate]] · [[Enum EntitlementKind]] · [[Enum EntitlementSource]]

## Superficie

- [[Controller platform]] · [[Controller entitlement]] · [[Pantalla platform]]

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Architecture Map]], [[Database Map]], [[Infrastructure Map]], [[Security Map]]
