---
id: modryva-automation-enfriamiento-de-reglas
title: Enfriamiento de Reglas
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/rule-cooldown.ts
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - checkRuleCooldown
  - DEFAULT_COOLDOWN_MS
created: 2026-07-12
updated: 2026-07-12
---

# Enfriamiento de Reglas

## Qué hace
Decide si una acción de regla puede volver a dispararse según cuándo lo hizo por última vez, para
evitar que una automatización se repita en ráfaga. `checkRuleCooldown(lastFiredMs, nowMs, options?)`
→ `{ allowed, remainingMs }`:

- Se permite si nunca disparó (`lastFiredMs === undefined`) o si transcurrió al menos `cooldownMs`
  desde el último disparo (`rule-cooldown.ts:32-48`).
- `remainingMs` es la espera no negativa restante (0 si permitido) (`:46-47`).
- Ventana por defecto `DEFAULT_COOLDOWN_MS = 60000` (1 min); un `cooldownMs` negativo se trata como 0
  (`:22`, `:37-38`). El reloj se inyecta vía `nowMs` (puro).

## Evidencia
- `modules/automation/src/rule-cooldown.ts:32-48`.
- Cableado en el bot, comando `/cooldown_regla`:
  `apps/bot/src/bot-update.service.ts:16361` (case), `:16369`
  `checkRuleCooldown(nowMs - secondsAgo * 1000, nowMs)`, respuesta 🟢/🔴 en `:16370-16374`.
- Import: `apps/bot/src/bot-update.service.ts:107` desde `@superbot/module-automation`.
- El handler `handleUtilityPlusCommand` está registrado en el pipeline en `:1590`.
- Tests: `modules/automation/src/rule-cooldown.test.ts`.

## Estado / cableado
`implemented`. El helper se ejecuta de verdad desde `/cooldown_regla`, pero el comando es
**diagnóstico / what-if**: recibe manualmente los segundos desde el último disparo y responde si
podría dispararse de nuevo. No hay un lastFiredMs persistido por regla que lo consuma automáticamente
en la evaluación real de automatizaciones (`matchAndRunAutomations` no usa este cooldown). No confundir
con el `cooldownMs` interno de [[Motor de Reglas]] (otra implementación, tampoco cableada).

## Preguntas abiertas
- ¿Se persiste en algún sitio el último disparo por regla para automatizar este cooldown? No se observa
  desde el módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Motor de Reglas]], [[Modelo AutomationRule]], [[Deduplicación de Reglas]]
