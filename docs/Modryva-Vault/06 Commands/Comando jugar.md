---
id: modryva-command-jugar
title: Comando jugar
type: command
domain: community
status: implemented
maturity: stable
source:
  - apps/bot/src/bot-update.service.ts
  - docs/COMMANDS.md
tags:
  - modryva
  - command
  - community
  - games
  - miniapp
aliases:
  - "/jugar"
  - "/juegos"
  - "/games"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /jugar

## Propósito
Abre la Mini App de juegos arcade. Es el "hub" de juegos (Tres en raya, RPS, etc.) integrado en la Mini App.

## Sintaxis
`/jugar` (alias `/juegos`, `/games`). En privado: botón `web_app` directo a `/games`. En grupo: enlaces
`t.me/<bot>/<miniapp>?startapp=...` por juego (Telegram no acepta `web_app` en botones de grupo), así las
partidas quedan asociadas al grupo para la clasificación.

## Permisos
Ninguno especial (cualquier miembro). No requiere bot admin.

## Implementación
Registrado como `games.hub` en `botHandlers()` (`apps/bot/src/bot-update.service.ts:1500`), delega en
`handleGamesHub(update, { appUrl, botUsername, miniAppName })` del [[Módulo games]]. Comentario del patrón
grupo-vs-privado en `bot-update.service.ts:2425-2429`. Solo emite botones si hay una URL https de Mini App.

## Modelos que toca
Ninguno por sí mismo (abre UI). Las partidas persisten desde la Mini App/servicios de juegos.

## Eventos
Ninguno directo.

## Errores / edge-cases
Sin `TELEGRAM_APP_URL` https configurada no muestra botón.

## Tests
`modules/games/**` (`handleGamesHub`) + `apps/bot/src/bot-update.service.test.ts`.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de: [[Bot Update Service]], [[Módulo games]], [[App web]]
- Relacionado con: [[Comando casino]], [[Comando trivia]], [[Comando rps]]
