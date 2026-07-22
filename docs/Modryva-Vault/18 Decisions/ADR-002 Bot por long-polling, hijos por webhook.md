---
id: modryva-adr-002
title: ADR-002 Bot por long-polling, hijos por webhook
type: decision
domain: decision
status: inferred
maturity: stable
source:
  - apps/bot/src/poller.ts
  - apps/bot/src/telegram-webhook.controller.ts
tags:
  - modryva
  - decision
  - botcore
created: 2026-07-12
updated: 2026-07-12
---

# ADR-002 — Bot padre por long-polling, bots hijos por webhook

## Estado
**inferred**.

## Contexto
El bot padre corre por long-polling y no expone un endpoint público entrante; los bots hijos (managed bots) sí necesitan
recibir updates de forma escalable.

## Decisión
El **padre** `@ModryvaBot` usa **long-polling** ([[Poller]], sin exponer puertos). Los **hijos** usan
**webhook** vía un túnel Cloudflare con nombre ([[Webhook de Bots Hijos]], [[Integración Cloudflare Tunnel]]).

## Evidencia
`apps/bot/src/poller.ts` (polling) y `apps/bot/src/telegram-webhook.controller.ts` (webhook entrante);
`docs/stable-tunnel-runbook.md`.

## Alternativas
Todo por webhook (requiere URL pública estable para el padre), todo por polling (no escala a N bots).

## Consecuencias positivas
Cero configuración de red para el padre; hijos escalables por URL fija.

## Consecuencias negativas
El polling es **single-consumer** → conflicto si hay dos instancias con el mismo token
([[Riesgo Long-polling single-consumer]]).

## Componentes afectados
[[Poller]] · [[Webhook de Bots Hijos]] · [[Managed Bots]].

## Relaciones
- Pertenece a: [[Decisions Map]]
- Relacionado con: [[Bot Core Map]], [[Modryva Hub Map]]
