---
id: modryva-job-trivia-announce
title: Job trivia-announce
type: workflow
domain: community
status: implemented
maturity: beta
source:
  - apps/worker/src/trivia-announce-processor.ts
tags:
  - modryva
  - workflow
  - community
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Job trivia-announce

## Qué hace
Anuncia la trivia comunitaria (p.ej. la trivia diaria de grupo) en el momento programado. Procesador
`apps/worker/src/trivia-announce-processor.ts`.

## Secuencia (a confirmar en el código)
Detecta grupos con trivia activa y ventana de anuncio, publica la pregunta/aviso — probablemente gateado
por [[Quiet Mode]] como el recap. Ver [[Trivia Comunitaria]].

## Tests
`apps/worker/src/trivia-announce-processor.test.ts`.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Depende de: [[App worker]]
- Relacionado con: [[Trivia Comunitaria]], [[Módulo community]], [[Quiet Mode]]
