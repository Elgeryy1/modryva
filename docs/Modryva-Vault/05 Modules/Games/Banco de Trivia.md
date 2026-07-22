---
id: modryva-games-trivia-bank
title: Banco de Trivia
type: feature
domain: games
status: implemented
maturity: stable
source:
  - modules/games/src/trivia.ts
  - modules/games/src/trivia-bank.ts
tags:
  - modryva
  - feature
  - games
aliases: ["trivia bank", TRIVIA_QUESTIONS, TRIVIA_BANK]
created: 2026-07-12
updated: 2026-07-12
---

# Banco de Trivia

## Qué hace
El almacén de preguntas de cultura general (es-ES) que alimenta toda la trivia del bot, más los helpers de selección determinista y parseo de comandos/callbacks de trivia nativa.

## Evidencia
- Datos: `TRIVIA_BANK` (`modules/games/src/trivia-bank.ts:4`) es un array de `TriviaQuestion`. Verificado por conteo: **5027 entradas** (`grep -c correctIndex trivia-bank.ts`), coherente con el "5000+" citado en `apps/api/src/games/games.service.ts:411`.
- Fachada: `TRIVIA_QUESTIONS = TRIVIA_BANK` (`modules/games/src/trivia.ts:12`); forma `TriviaQuestion{question, options, correctIndex, category?, difficulty?}` (`trivia.ts:4-10`).
- Helpers: `pickQuestionIndex(seed, count)` (selección determinista, `trivia.ts:15-21`); `isCorrectAnswer(question, optionIndex)` (`trivia.ts:54-57`); parseo de comando `/trivia` (`parseTriviaCommand`, `trivia.ts:30-37`) y de callback `trivia:<sessionId>:<optionIndex>` (`parseTriviaAnswer`, `trivia.ts:40-52`).
- Detalle del banco: incluye variantes reformuladas de la misma pregunta con opciones barajadas (ver `trivia-bank.ts:5-19`), lo que reduce memorización de posición de respuesta.
- Tests: `modules/games/src/trivia.test.ts`, `trivia-bank.test.ts`.
- Consumido por: [[Trivia Diaria de Grupo]] (`games.service.ts` `dailyTrivia`/`quizBatch`) y la trivia nativa en chat (`apps/bot/src/bot-update.service.ts` importa `TRIVIA_QUESTIONS`, `pickQuestionIndex`, `parseTriviaAnswer`, `parseTriviaCommand`, `isCorrectAnswer`, L350-365).

## Estado / cableado
`implemented`. Es data + utilidades puras; la selección por ventana la hace [[Trivia Diaria de Grupo]] con las funciones de `daily-trivia.ts`.

## Preguntas abiertas
- Los campos `category`/`difficulty` de `TriviaQuestion` son opcionales y las entradas iniciales del banco no los rellenan; no verificado si algún subconjunto los usa (sería la base para el [[Quiz Adaptativo]], hoy sin cablear).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo games]]
- Relacionado con: [[Trivia Diaria de Grupo]], [[Quiz Arcade Solo]], [[Quiz Adaptativo]], [[Comando trivia]]
