---
id: modryva-community-glosario
title: Glosario del Grupo
type: feature
domain: community
status: implemented
maturity: stable
source:
  - modules/community/src/group-glossary.ts
tags:
  - modryva
  - feature
  - community
aliases: [glosario, glossary, diccionario, siglas]
created: 2026-07-12
updated: 2026-07-12
---

# Glosario del Grupo

## Qué hace
Diccionario interno del grupo: términos, bromas o siglas que el bot entiende y puede explicar. Gestión con `/glosario set|remove|list`, y detección de términos mencionados en un texto (como palabra completa, ignorando mayúsculas y acentos).

## Evidencia
- `normalizeGlossaryTerm` (sin diacríticos, minúsculas, espacios colapsados) (`modules/community/src/group-glossary.ts:40-46`).
- `lookupGlossary(text, glossary)` devuelve los términos presentes en orden de aparición, sin duplicar, casando por palabra completa (`group-glossary.ts:74-109`).
- `parseGlossaryCommand` (set/remove/list) con errores discriminados (`group-glossary.ts:122-170`).
- Test: `modules/community/src/group-glossary.test.ts`.

## Estado / cableado
Implemented. Handler `parseGlossaryCommand` en `apps/bot/src/bot-update.service.ts:12029`. Import en `bot-update.service.ts:238`.

## Preguntas abiertas
- Si `lookupGlossary` se aplica de forma ambiente (explicar términos automáticamente en mensajes) o solo bajo `/glosario` → no se confirmó el uso ambiente de `lookupGlossary` → `unknown`.
- Persistencia del glosario por grupo (modelo/clave) → `unknown`.

## Relaciones
- Pertenece a: [[Modules Map]]
- Depende de: [[Módulo community]]
- Relacionado con: [[Notas Guardadas]], [[Comando glosario]]
