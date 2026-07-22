---
id: modryva-model-gamesession
title: Modelo GameSession
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/game-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo GameSession

## Propósito
Sesión de un mini-juego de comunidad (p. ej. trivia): tipo, estado, `payload` con el reto,
`correctIndex` y ganador. Tabla `game_sessions`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `tenantId` / `chatId` | String | Contexto. |
| `kind` | String | Tipo de juego. |
| `status` | String | `@default("open")`. |
| `payload` | Json | Datos del reto. |
| `correctIndex` | Int | Respuesta correcta. |
| `winnerTelegramId` | BigInt? | Ganador. |

## Índices / restricciones
`@@index([tenantId, chatId, status])`.

## Enums usados
Ninguno.

## Acceso
`game-repository.ts` (abrir/cerrar sesión, registrar acierto). Ver [[Trivia Comunitaria]],
[[Módulo games]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Trivia Comunitaria]]
- Relacionado con: [[Modelo GameScore]], [[Database Map]]
