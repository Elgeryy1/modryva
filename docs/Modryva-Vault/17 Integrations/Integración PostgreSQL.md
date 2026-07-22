---
id: modryva-integration-postgresql
title: Integración PostgreSQL
type: integration
domain: integration
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - docker-compose.yml
tags:
  - modryva
  - integration
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Integración PostgreSQL

## Qué es
Base de datos relacional principal. Acceso vía **Prisma** ([[Package data]]). 127 modelos → [[Database Map]].

## Punto de contacto
[[Env DATABASE_URL]]. Servicio `postgres` en [[Docker Compose Stack]]. Repositorios en `packages/data/src`.

## Gotcha operativo
El Dockerfile solo hace `prisma generate` (no crea tablas). Volumen nuevo = esquema vacío → el bot arranca
pero falla cada update. Arreglo: `db push`. Ver [[Runbook Migraciones Prisma]] y
[[Riesgo Sin migraciones Prisma versionadas]].

## Relaciones
- Pertenece a: [[Integrations Map]]
- Utilizado por: [[Package data]], [[App api]], [[App bot]], [[App worker]]
- Relacionado con: [[Database Map]], [[Infrastructure Map]]
