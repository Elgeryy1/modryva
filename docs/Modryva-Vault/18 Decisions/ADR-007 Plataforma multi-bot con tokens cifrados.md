---
id: modryva-adr-007
title: ADR-007 Plataforma multi-bot con tokens cifrados
type: decision
domain: decision
status: inferred
maturity: stable
source:
  - packages/data/src/platform-repository.ts
tags:
  - modryva
  - decision
  - platform
created: 2026-07-12
updated: 2026-07-12
---

# ADR-007 — Plataforma multi-bot con tokens de bots hijos cifrados

## Estado
**inferred**.

## Contexto
Modryva actúa como plataforma tipo GroupHelp: un bot padre crea/gestiona bots hijos, cuyos tokens de
Telegram son secretos muy sensibles.

## Decisión
Guardar el token de cada bot hijo **cifrado** ([[Modelo ManagedBot]] `encryptedToken`), con una clave de
entorno `MANAGED_BOT_TOKEN_KEY`; resolver el bot/tenant por update ([[Bot Scoping]]); roles de plataforma
propios ([[Enum PlatformRole]]).

## Evidencia
`packages/data/src/platform-repository.ts` (cifrado/descifrado con `MANAGED_BOT_TOKEN_KEY`);
[[Managed Bots]], [[Modelo ManagedBot]].

## Alternativas
Guardar tokens en claro (inaceptable), un proceso por bot (no escala).

## Consecuencias positivas
Multi-tenant real con secretos protegidos; un solo stack sirve N bots.

## Consecuencias negativas
`MANAGED_BOT_TOKEN_KEY` es un **punto único de fallo**: perderla/rotarla mal deja los tokens ilegibles
([[Riesgo Tokens de bots hijos cifrados]]).

## Componentes afectados
[[Managed Bots]] · [[Modelo ManagedBot]] · [[Bot Scoping]] · [[Package data]].

## Relaciones
- Pertenece a: [[Decisions Map]]
- Relacionado con: [[Modryva Hub Map]], [[Managed Bots]]
