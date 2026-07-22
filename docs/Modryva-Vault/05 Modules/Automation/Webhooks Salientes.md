---
id: modryva-automation-webhooks-salientes
title: Webhooks Salientes
type: feature
domain: automation
status: implemented
maturity: stable
source:
  - modules/automation/src/webhooks.ts
  - apps/bot/src/bot-update.service.ts
  - apps/worker/src/webhook-processor.ts
tags:
  - modryva
  - feature
  - automation
aliases:
  - parseWebhookCommand
  - buildWebhookBody
  - signWebhook
  - verifyWebhookSignature
created: 2026-07-12
updated: 2026-07-12
---

# Webhooks Salientes

## Qué hace
Acción de automatización que entrega eventos del bot a URLs externas, firmadas con HMAC-SHA256. El
módulo cubre parseo del comando, construcción del cuerpo y firma/verificación:

- `parseWebhookCommand(update)` parsea `/webhook add <url> | list | remove <id>`, valida que la URL sea
  http(s) y devuelve resultado discriminado ok/error (`webhooks.ts:30-72`, `isHttpUrl` `:21-28`).
- `buildWebhookBody(event, payload, atMs)` → JSON determinista `{ event, sentAt, payload }`; `sentAt`
  deriva de `atMs` para que la misma entrada produzca la misma firma (`webhooks.ts:79-88`).
- `signWebhook(body, secret)` → HMAC-SHA256 hex (`node:crypto`, `:94-95`).
- `verifyWebhookSignature(body, secret, signature)` compara en tiempo constante (`timingSafeEqual`) y
  devuelve false ante firmas malformadas o manipuladas, sin lanzar (`:102-116`).

## Evidencia
- `modules/automation/src/webhooks.ts:30-116`.
- Cableado (bot) en `handleWebhookCommand`: `apps/bot/src/bot-update.service.ts:6955`
  (`parseWebhookCommand`), alta con secreto generado y `buildWebhookBody("webhook.registered", …)` en
  `:7021-7025`, encola la entrega vía `webhookRepository.enqueueDelivery(...)` `:7026-7033`.
- Cableado (worker) en `apps/worker/src/webhook-processor.ts:2` (import `signWebhook`), `:38`
  `const signature = signWebhook(delivery.body, delivery.secret)` al entregar.
- Import bot: `apps/bot/src/bot-update.service.ts:105` (`buildWebhookBody`), `:112`
  (`parseWebhookCommand`).
- Tests: `modules/automation/src/webhooks.test.ts`.

## Estado / cableado
`implemented` (end-to-end). A diferencia de otros helpers del módulo, esta acción **sí produce efectos
reales**: el comando `/webhook add` registra el webhook, encola un ping firmado y el worker lo entrega
firmando el cuerpo. El envío HTTP y su reintento viven en la capa worker/repositorio de webhooks (fuera
de este módulo). `verifyWebhookSignature` no se usa en `apps/` (búsqueda = 0): la verificación sería del
lado receptor.

## Preguntas abiertas
- El reintento/entrega real (backoff, DLQ) vive en `apps/worker` y en el repositorio de webhooks; su
  detalle no es parte de este módulo. Posible relación con [[Reintentos con Backoff]] → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo automation]]
- Relacionado con: [[Presets de Alerta]], [[Eventos Internos]], [[Reintentos con Backoff]],
  [[Feeds RSS]]
