---
id: moc-product
title: Product Map
type: moc
domain: product
status: implemented
maturity: beta
tags:
  - modryva
  - moc
  - product
created: 2026-07-12
updated: 2026-07-12
---

# Product Map

Qué es Modryva **para el usuario final**: un bot de Telegram para gestionar comunidades, con moderación,
juegos, IA y un panel/Mini App. Notas en `02 Product/`.

## Áreas de producto

- **Moderación de grupos** → [[Security Map]] (warn/mute/ban, antiflood, antiraid, captcha, blocklists).
- **Comunidad y engagement** → [[Módulo community]] (welcome, polls, recaps, misiones, gratitud, trivia).
- **Casino social** → [[Casino Map]] (13+ juegos, economía de fichas, Telegram Stars).
- **Inteligencia artificial** → [[Módulo ai]] (conversación, memoria, acceso por packs/códigos).
- **Panel / Mini App** → 28 pantallas web ([[Pantalla config/moderation]], [[Pantalla casino]]…).
- **Plataforma multi-bot** → [[Modryva Hub Map]] (crea tu propio bot hijo).
- **Automatizaciones** → [[Módulo automation]] · [[Workflows Map]].
- **Soporte / tickets** → [[Módulo support]].

## Modelo de negocio

- Funciones **gratuitas** y **Pro** vía entitlements/packs. Ver [[Promo Codes y Entitlements]].
- Monetización por **Telegram Stars** (chip packs, packs de IA). Ver [[Chip Economy]].
- Roadmap y planes: [[Roadmap Map]] (`docs/PLAN-800-IDEAS.md`, `docs/redesign-master-plan.md`).

## Pantallas web (28)

Config: moderation, automations, federation, blocklist, filters, gamification, analytics, risk, users,
network, premium, ai-pack, backup, onboarding, schedule-rules, rituals, quiet, recap, wizard. Otras:
casino, games, platform, help, terms, privacy. Ver [[API Map]] para qué endpoint alimenta cada una.

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Security Map]], [[Casino Map]], [[Modryva Hub Map]], [[Roadmap Map]]
