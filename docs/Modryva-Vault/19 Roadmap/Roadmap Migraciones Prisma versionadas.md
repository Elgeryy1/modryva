---
id: modryva-roadmap-migraciones-versionadas
title: Roadmap Migraciones Prisma versionadas
type: roadmap
domain: roadmap
status: planned
maturity: unknown
source:
  - Dockerfile
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - roadmap
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Roadmap — adoptar migraciones Prisma versionadas

## Estado
**planned** (no implementado; hoy se usa `db push` manual).

## Problema que resuelve
Sustituir la decisión actual [[ADR-003 Prisma sin migraciones versionadas]] para eliminar
[[Riesgo Sin migraciones Prisma versionadas]]: volúmenes nuevos con esquema vacío, `db push --accept-data-loss`
destructivo y ausencia de "down".

## Idea
- Introducir `prisma migrate` con carpeta `packages/data/prisma/migrations` versionada en git.
- Ejecutar `prisma migrate deploy` en el arranque del contenedor (o en un paso de deploy), en lugar de solo
  `prisma generate` en el [[Dockerfile|Dockerfile]].
- Documentar backfill del estado actual (baseline) del esquema ya existente en producción.

## Impacto
Alto (integridad de datos y despliegues seguros). Habilita rollback de esquema real
([[Runbook Rollback]]).

## Evidencia del estado actual
`Dockerfile` solo hace `prisma generate`; no existe carpeta `migrations`. Ver [[Runbook Migraciones Prisma]].

## Preguntas abiertas
- ¿Cómo baselinar las ~92+ tablas ya creadas por `db push` sin pérdida?

## Relaciones
- Pertenece a: [[Roadmap Map]]
- Sustituye a: [[ADR-003 Prisma sin migraciones versionadas]]
- Mitiga: [[Riesgo Sin migraciones Prisma versionadas]]
- Relacionado con: [[Database Map]], [[Operations Map]]
