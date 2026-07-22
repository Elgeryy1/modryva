---
id: modryva-community-stickers-cita
title: Stickers de Cita
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/quotes.ts
tags:
  - modryva
  - feature
  - community
aliases: [quote, quotly, q, cita, sticker de cita]
created: 2026-07-12
updated: 2026-07-12
---

# Stickers de Cita

## Qué hace
Estilo Quotly/@QuotLyBot: `/q` en respuesta a un mensaje genera una imagen "tarjeta de cita" con el autor y su texto. El módulo decide QUÉ renderizar (payload) de forma determinista; el render lo hace un servicio inyectable. Acepta formato `png` (además del webp/sticker por defecto) y color de fondo por nombre (es/en) o hex.

## Evidencia
- `quoteCommandNames = {q, quote, quot}`; `parseQuoteCommand` mezcla opciones independientes de orden (`modules/community/src/quotes.ts:22,77-96`).
- `resolveQuoteColor` acepta hex y nombres ES/EN (`quotes.ts:24-69`); `extractQuoteSource` saca autor+texto del `reply_to_message` crudo (`quotes.ts:113-169`).
- `buildQuotePayload` construye el body forma LyoSU quote-api (512x768, scale 2, fondo `#1b1429` por defecto) (`quotes.ts:193-223`).
- Test: `modules/community/src/quotes.test.ts`.

## Estado / cableado
Implemented. Handler en `apps/bot/src/bot-update.service.ts:9775-9793+`: `parseQuoteCommand` → `extractQuoteSource` → `buildQuotePayload`, entregado al renderer. Imports en `bot-update.service.ts:139,189,250`.

## Preguntas abiertas
- Qué renderer concreto consume el payload (servicio HTTP externo, cola, etc.) no se resuelve en el fichero de lógica → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Fun]], [[Comando quote]]
