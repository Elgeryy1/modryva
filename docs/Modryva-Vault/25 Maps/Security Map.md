---
id: moc-security
title: Security Map
type: moc
domain: security
status: implemented
maturity: beta
tags:
  - modryva
  - moc
  - security
created: 2026-07-12
updated: 2026-07-12
---

# Security Map

Moderación y seguridad de grupos. Lógica en `modules/security` (124 ficheros, patrón feature-por-fichero),
modelos de moderación en Prisma, comandos en el bot e inbox de revisión en la Mini App. Hub del módulo:
[[Módulo security]].

## Sistemas

- [[Antiflood]] · [[Antiraid]] · [[Captcha]] · [[Blocklists]] · [[Content Locks]] · [[Char Filters]] ·
  [[Admin Tools]] · [[Circuit Breaker]] · [[Group Hygiene]]

## Flujos de sanción

- [[Flujo Warn]] · [[Flujo Mute]] · [[Flujo Ban]]
- Nota clave: el bot **no siempre es admin** → patrón "ver ≠ actuar" / modo vigilante honesto.

## Comandos

[[Comando ban]] · [[Comando mute]] · [[Comando unmute]] · [[Comando warn]] · [[Comando unwarn]] ·
[[Comando kick]] · [[Comando verificar]]

## Datos

[[Modelo ModerationCase]] · [[Modelo Sanction]] · [[Modelo Warning]] · [[Modelo Report]] ·
[[Modelo Evidence]] · [[Modelo Appeal]] · [[Modelo CaptchaConfig]] · [[Modelo AntifloodConfig]] ·
[[Modelo AntiraidConfig]] · [[Modelo WarnPolicyConfig]] · [[Modelo BlocklistConfig]]

## Revisión

- [[Controller moderation-inbox]] — cola de revisión en la Mini App.
- [[Pantalla config/moderation]] — configuración desde el panel.

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Modules Map]], [[Commands Map]], [[Database Map]], [[Modryva Hub Map]]
