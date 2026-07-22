---
id: modryva-support-appeal-classification
title: Clasificación de Apelaciones
type: feature
domain: support
status: implemented
maturity: stable
source:
  - modules/support/src/appeal-classification.ts
tags:
  - modryva
  - feature
  - support
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Clasificación de Apelaciones

## Qué hace
Clasifica el texto libre de una apelación en una categoría dominante:
`abuso`, `error`, `arrepentimiento`, `confusion` o `sin_clasificar`.
`categorizeAppeal` normaliza el texto (minúsculas, sin acentos) y escanea
conjuntos de palabras clave en orden de prioridad (el abuso hostil se detecta
primero para tratarlo antes que intenciones benignas). Devuelve la categoría
ganadora más los tokens que la dispararon; determinista.

## Evidencia
- `modules/support/src/appeal-classification.ts:109` `categorizeAppeal`; reglas
  por categoría en `appeal-classification.ts:42`.
- Test: `modules/support/src/appeal-classification.test.ts`.
- Cableado: `apps/bot/src/bot-update.service.ts:521` (import) y
  `bot-update.service.ts:15051` (`categorizeAppeal(text)`), servido por el
  comando `/clasificar_apelacion` dentro de `handleUtilityPlusCommand`.

## Estado / cableado
`implemented`: expuesto como comando de utilidad/diagnóstico
`/clasificar_apelacion` que devuelve la categoría de un texto dado. No se
verificó que la clasificación se aplique automáticamente dentro del flujo de
[[Apelaciones por Privado]].

## Preguntas abiertas
- ¿Se invoca `categorizeAppeal` de forma automática al crear una apelación, o
  solo bajo demanda por el comando? → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo support]]
- Relacionado con: [[Apelaciones por Privado]], [[Contexto de Apelación para Staff]], [[Modelo Appeal]]
