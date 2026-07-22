---
id: modryva-command-trivia
title: Comando trivia
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - community
  - games
aliases:
  - "/trivia"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /trivia

## Propósito
Lanza una pregunta de trivia con opciones inline. Banco de preguntas propio. **Solo la primera respuesta
correcta** cierra la sesión y suma 1 punto; las sesiones sobreviven a reinicios (se persisten).

## Sintaxis
`/trivia` (sin argumentos, dentro del grupo). Se responde por callback `trivia:<sessionId>:<i>`.

## Permisos
Ninguno especial (cualquier miembro). No requiere bot admin.

## Implementación
`handleTriviaCommand` (`apps/bot/src/bot-update.service.ts:5515`) vía `parseTriviaCommand`, registrado como
`trivia.command` (línea 1519). Elige pregunta con `pickQuestionIndex` sobre `TRIVIA_QUESTIONS` y crea la
sesión con `gameRepository.createSession(...,"trivia",...)`. La respuesta la gestiona `handleTriviaAnswer`
(5569) con cierre atómico (`closeWithWinner`).

## Modelos que toca
[[Modelo GameSession]] (kind `trivia`) y [[Modelo GameScore]] al acertar.

## Eventos
`recordAudit` `game.trivia.started` (5549).

## Errores / edge-cases
Fuera de grupo: "La trivia se juega dentro de un grupo". "No hay preguntas disponibles" si el banco está vacío.

## Tests
`apps/bot/src/bot-update.service.test.ts` (flujo de trivia y cierre único).

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo games]]
- Produce: [[Modelo GameSession]], [[Modelo GameScore]]
- Relacionado con: [[Comando jugar]], [[Comando poll]]
