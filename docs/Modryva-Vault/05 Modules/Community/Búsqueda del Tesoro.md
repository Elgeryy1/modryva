---
id: modryva-community-busqueda-tesoro
title: Búsqueda del Tesoro
type: feature
domain: community
status: implemented
maturity: experimental
source:
  - modules/community/src/scavenger-hunt.ts
tags:
  - modryva
  - feature
  - community
aliases: [caza, scavenger hunt, busqueda del tesoro, pistas]
created: 2026-07-12
updated: 2026-07-12
---

# Búsqueda del Tesoro

## Qué hace
Caza por pistas: una secuencia de pasos donde cada respuesta correcta avanza al siguiente. `/caza start <pista1>|<pista2>|...` arranca, `/caza estado` muestra el progreso y `/caza responder <texto>` valida la respuesta actual (comparación normalizada: sin acentos, espacios colapsados, minúsculas).

## Evidencia
- `HuntState { stepIndex, total }`; `checkHuntClue(answer, expected)` compara tras normalizar (`modules/community/src/scavenger-hunt.ts:12-34`).
- `advanceHunt` satura en `total` y marca `finished`; `huntProgress` devuelve fracción [0,1] (`scavenger-hunt.ts:42-65`).
- Test: `modules/community/src/scavenger-hunt.test.ts`.

## Estado / cableado
Implemented. Handler `/caza` (start/estado/responder) en `apps/bot/src/bot-update.service.ts:12850+`: el estado se guarda en `chatSettingRepository`; `huntProgress` para el progreso (`:12881`), `checkHuntClue` valida (`:12902`) y `advanceHunt` avanza (`:12905`). Imports en `bot-update.service.ts:122,148,204` (`HuntState`).

## Preguntas abiertas
- Ninguna relevante para la lógica; el estado persiste como valor en chat-setting (clave concreta no listada aquí).

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Coop Missions]], [[Comando caza]]
