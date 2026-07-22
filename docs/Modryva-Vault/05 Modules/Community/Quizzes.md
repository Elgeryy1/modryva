---
id: modryva-community-quizzes
title: Quizzes
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/quizzes.ts
tags:
  - modryva
  - feature
  - community
aliases: [quiz, quizbot, quizscores, quiztop, clasificacion]
created: 2026-07-12
updated: 2026-07-12
---

# Quizzes

## Qué hace
Cuestionarios estilo @QuizBot creados por el usuario: `/quiz Pregunta | Correcta | Incorrecta1 | ...` genera un quiz con botones; los aciertos suman puntos y hay clasificación (`/quizscores`, `/quiztop`, `/trivialeaderboard`). Distinto de [[Trivia Comunitaria]] (banco de preguntas en `module-games`): aquí las preguntas las escribe el grupo.

## Evidencia
- `parseQuizCommand`: separa por `|`, exige pregunta + ≥2 opciones y ≤10 (`modules/community/src/quizzes.ts:34-63`).
- `orderQuizOptions` coloca la correcta en `seed % total` de forma determinista (`quizzes.ts:71-94`); callback `parseQuizAnswer` de forma `quiz:<sessionId>:<optionIndex>` (`quizzes.ts:100-115`).
- `isQuizCorrect`, `isQuizScoresCommand` y `formatQuizLeaderboard` (medallas de podio) (`quizzes.ts:120-154`).
- Test: `modules/community/src/quizzes.test.ts`.

## Estado / cableado
Implemented. Handler de creación en `apps/bot/src/bot-update.service.ts:5440`; comprobación de leaderboard en `:5495` (`isQuizScoresCommand`); resolución de respuesta por callback en `:5511` (`parseQuizAnswer`). Imports en `bot-update.service.ts:195,211,229,248,249`.

## Preguntas abiertas
- Persistencia de sesiones y puntuaciones (modelo Prisma exacto) no se ve en la lógica pura → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Trivia Comunitaria]], [[Polls]], [[Comando quiz]]
