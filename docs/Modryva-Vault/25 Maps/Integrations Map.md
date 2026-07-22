---
id: moc-integrations
title: Integrations Map
type: moc
domain: integration
status: partial
maturity: beta
tags:
  - modryva
  - moc
  - integration
created: 2026-07-12
updated: 2026-07-12
---

# Integrations Map

Sistemas externos con los que Modryva habla. Notas en `17 Integrations/`.

## Verificadas

- [[Integración Telegram Bot API]] — vía [[Package telegram]] (gateway). Updates + envío de mensajes/dice/invoices.
- [[Integración Telegram Stars]] — pagos (`pre_checkout_query` / `successful_payment`) → [[Chip Economy]].
- [[Integración Telegram Mini Apps]] — initData firmado ([[Package auth]], [[Guard InitData]]).
- [[Integración PostgreSQL]] — Prisma ([[Package data]]).
- [[Integración Redis]] — colas/cache.
- [[Integración Cloudflare Tunnel]] — webhooks de bots hijos.
- [[Integración RSS]] — [[Job rss]] → posts.

## Por verificar (unknown)

- Proveedor(es) de IA — ver [[Módulo ai]] (`buildAiProviderFromEnv`); confirmar cuál(es) en el código.
- `QUOTE_API_URL` — API externa de citas (env detectada). Ver [[Env QUOTE_API_URL]].

## Relaciones

- Pertenece a: [[Modryva Home]]
- Relacionado con: [[Architecture Map]], [[Infrastructure Map]], [[Modryva Hub Map]]
