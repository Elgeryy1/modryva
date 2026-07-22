---
id: modryva-adr-003
title: ADR-003 Prisma sin migraciones versionadas
type: decision
domain: decision
status: inferred
maturity: stable
source:
  - Dockerfile
tags:
  - modryva
  - decision
  - data
created: 2026-07-12
updated: 2026-07-12
---

# ADR-003 — Prisma sin migraciones versionadas (db push)

## Estado
**inferred** (y cuestionable → ver consecuencias).

## Contexto
Prototipo de evolución rápida del esquema (127 modelos) con un solo entorno de despliegue.

## Decisión
No usar `prisma migrate` con carpeta `migrations`. El Dockerfile solo hace `prisma generate`; los cambios de
esquema se aplican con **`db push`** manual contra la BD.

## Evidencia
`Dockerfile` (solo `prisma generate`); ausencia de `packages/data/prisma/migrations`;
[[Runbook Migraciones Prisma]].

## Alternativas
`prisma migrate` versionado (más seguro, algo más de fricción).

## Consecuencias positivas
Iteración rápida del esquema en desarrollo.

## Consecuencias negativas
Volumen nuevo = esquema vacío → bot roto en silencio; `db push --accept-data-loss` puede borrar datos.
Es deuda: [[Riesgo Sin migraciones Prisma versionadas]]. Candidato a cambiar:
[[Roadmap Migraciones Prisma versionadas]].

## Componentes afectados
[[Package data]] · [[Integración PostgreSQL]] · [[Operations Map]].

## Relaciones
- Pertenece a: [[Decisions Map]]
- Sustituido por: [[Roadmap Migraciones Prisma versionadas]]
- Relacionado con: [[Riesgo Sin migraciones Prisma versionadas]]
