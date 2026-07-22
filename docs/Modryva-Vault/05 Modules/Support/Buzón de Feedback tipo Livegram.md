---
id: modryva-support-feedback
title: Buzón de Feedback tipo Livegram
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/feedback.ts
tags:
  - modryva
  - feature
  - support
aliases:
  - Recolección de Feedback
created: 2026-07-12
updated: 2026-07-12
---

# Buzón de Feedback tipo Livegram

## Qué hace
Bandeja de feedback estilo Livegram: un usuario escribe al bot por privado, su
mensaje se reenvía a un grupo de staff con un marcador de origen oculto, y
cuando un miembro del staff responde a ese mensaje reenviado el marcador indica
a qué usuario contestar. Incluye además un comando de difusión a todos los que
han escrito al bot.
- `parseFeedbackCommand`: reconoce `/setfeedback` (fijar grupo de staff),
  `/unsetfeedback` (quitarlo) y `/broadcast <mensaje>` (difusión, con error
  `text-required` si falta texto).
- `buildFeedbackRelay(name, telegramUserId, text)`: arma el mensaje que se
  publica en el grupo de staff, terminado en un marcador oculto `id:<userId>`
  (con carácter de ancho cero) para enrutar la respuesta.
- `parseFeedbackOrigin(relayedText)`: extrae el id de usuario de origen del
  texto reenviado al que responde el staff; `null` si no hay marcador.

## Evidencia
- `modules/support/src/feedback.ts:24` `parseFeedbackCommand`;
  `feedback.ts:56` `buildFeedbackRelay`; `feedback.ts:67` `parseFeedbackOrigin`;
  marcador oculto en `feedback.ts:50`.
- Test: `modules/support/src/feedback.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:8805`
  (`parseFeedbackCommand(update)`) y `bot-update.service.ts:8901`
  (`buildFeedbackRelay(...)`) dentro de `handleFeedbackCommand`.

## Estado / cableado
`implemented`: parser y relay cableados a `handleFeedbackCommand`. La
configuración persistida del grupo de staff y de los usuarios que han escrito
vive en los modelos de datos (ver relaciones).

## Preguntas abiertas
- El detalle de la difusión (a cuántos usuarios y con qué límites de rate) se
  resuelve en el handler de `apps/bot`, fuera de este módulo → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Modelo FeedbackConfig]], [[Modelo FeedbackUser]]
