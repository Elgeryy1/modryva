---
id: modryva-community-ayuda-discreta
title: Ayuda Discreta
type: feature
domain: community
status: implemented
maturity: experimental
source:
  - modules/community/src/discreet-help.ts
tags:
  - modryva
  - feature
  - community
aliases: [ayuda_discreta, discreet help, pedir ayuda, SOS]
created: 2026-07-12
updated: 2026-07-12
---

# Ayuda Discreta

## Qué hace
Permite pedir ayuda al staff sin exponerse en público: dado un texto, decide si es una petición de ayuda y por qué canal responder (`privado` para sacarlo del chat público, `ninguno` si no procede). Detección insensible a mayúsculas y acentos.

## Evidencia
- Frases disparadoras `HELP_PHRASES` (ayuda, socorro, necesito a un admin, reportar en privado) (`modules/community/src/discreet-help.ts:33-38`).
- `foldText` normaliza acentos y `routeDiscreetHelp(input)` devuelve `{ needsHelp, channel, matched }` (`discreet-help.ts:45-93`).
- Test: `modules/community/src/discreet-help.test.ts`.

## Estado / cableado
Implemented. Caso `ayuda_discreta` del dispatcher: toma el texto del comando y llama `routeDiscreetHelp({ text })` (`apps/bot/src/bot-update.service.ts:15311-15321`). Import en `bot-update.service.ts:289`.

## Preguntas abiertas
- El cableado actual recibe el texto como argumento de `/ayuda_discreta`; no se halló uso ambiente (analizar cada mensaje del chat para ofrecer ayuda proactiva) → posible pendiente.
- Cómo se avisa realmente al admin por privado (acción concreta) no está en la lógica pura → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Quiet Mode]], [[Analítica de Conflicto]]
