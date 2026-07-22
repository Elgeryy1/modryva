---
id: modryva-command-q
title: Comando q
type: command
domain: utility
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - utility
  - fun
aliases:
  - "/q"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /q

## Propósito
Convierte un mensaje respondido en una **cita** con formato (imagen PNG o sticker), estilo "quote bot".

## Sintaxis
Responde a un mensaje con `/q` (sticker por defecto) o `/q png` (imagen). Acepta opciones de formato/color
(`parseQuoteCommand`).

## Permisos
Ninguno especial (cualquier miembro). No requiere ser admin del grupo, pero el bot debe poder enviar
foto/sticker en el chat.

## Implementación
`handleQuoteCommand` (`apps/bot/src/bot-update.service.ts:9724`) vía `parseQuoteCommand`, registrado como
`quote.command` (línea 1562). Extrae el mensaje fuente (`extractQuoteSource`), construye el payload
(`buildQuotePayload`) y renderiza con `quoteRenderer.renderQuote`; envía por `sendPhoto`/`sendSticker`.
La imagen es la respuesta (el handler devuelve `null`, 9795).

## Modelos que toca
No persiste dominio; escribe [[Modelo AuditLog]].

## Eventos
`recordAudit` `quote.generated` (9787).

## Errores / edge-cases
Sin mensaje respondido: "Responde a un mensaje con /q...". Si el renderer falla: "No pude generar la cita...".

## Tests
`apps/bot/src/bot-update.service.test.ts` (flujo de cita).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Package telegram]]
- Produce: [[Modelo AuditLog]]
- Relacionado con: [[Comando id]], [[Comando rps]]
