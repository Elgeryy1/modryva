---
id: modryva-job-webhook
title: Job webhook
type: workflow
domain: platform
status: implemented
maturity: beta
source:
  - apps/worker/src/webhook-processor.ts
tags:
  - modryva
  - workflow
  - platform
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Job webhook

## Qué hace
Entrega **webhooks salientes** (eventos de la plataforma hacia URLs externas configuradas). Procesador
`apps/worker/src/webhook-processor.ts`.

## Secuencia
1. Toma entregas pendientes ([[Modelo Webhook]] / [[Modelo WebhookDelivery]]).
2. Hace el POST al endpoint destino, con reintentos/backoff.
3. Registra el resultado (éxito/fallo) en [[Modelo WebhookDelivery]] → [[Observability Map]].

> No confundir con el webhook ENTRANTE de los bots hijos ([[Webhook de Bots Hijos]]), que lo maneja el
> [[Controller telegram-webhook]] en el bot.

## Tests
`apps/worker/src/webhook-processor.test.ts`.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Depende de: [[App worker]]
- Consume: [[Modelo Webhook]], [[Modelo WebhookDelivery]]
- Relacionado con: [[Modryva Hub Map]], [[Observability Map]]
