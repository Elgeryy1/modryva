---
id: modryva-guia-anadir-tabla
title: Guía Añadir una Tabla
type: guide
domain: developer
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src
tags:
  - modryva
  - guide
  - developer
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Guía — añadir una tabla / modelo Prisma

> **Ojo:** el proyecto **no usa migraciones versionadas** ([[ADR-003 Prisma sin migraciones versionadas]]).
> El esquema se aplica con `db push` manual. Saltarte el `db push` deja el bot roto en silencio en
> producción ("table does not exist").

## Pasos
1. **Define el modelo** en `packages/data/prisma/schema.prisma` (respeta enums/relaciones existentes).
2. **Crea un repositorio** (o extiende uno) en `packages/data/src/*-repository.ts` para leer/escribir la
   tabla — no accedas al cliente Prisma crudo desde las apps.
3. **Aplica el esquema y regenera el cliente** ([[Runbook Migraciones Prisma]]):
   ```bash
   # host, contra la BD:
   DATABASE_URL="postgresql://superbot:superbot@localhost:5433/superbot?schema=public" \
     node node_modules/prisma/build/index.js db push --schema packages/data/prisma/schema.prisma
   node node_modules/prisma/build/index.js generate --schema packages/data/prisma/schema.prisma
   ```
4. **Rebuild** de las imágenes que usan el modelo (el cliente se hornea en build) → [[Runbook Desplegar]].
5. **En producción / volumen nuevo**: aplica el `db push` DENTRO del contenedor y reinicia
   ([[Runbook Migraciones Prisma]]).

## Trampa habitual
Crear la tabla en el schema y **no** cablear ningún lector/escritor: el inventario halló **21 modelos así**
(sin uso real). Si no la vas a leer/escribir todavía, es andamiaje → márcalo y sigue
[[Roadmap Wiring Idea Bank]]. Ver [[Data Model Overview]].

## Checklist
- [ ] Modelo en `schema.prisma`.
- [ ] Repositorio en `packages/data/src`.
- [ ] `db push` + `generate` + rebuild.
- [ ] (prod) `db push` en el contenedor + restart.
- [ ] Nota en el Vault: `Modelo <Nombre>` (ver [[Conventions]]).

## Relaciones
- Pertenece a: [[Developer Onboarding Map]]
- Depende de: [[Package data]], [[Database Map]]
- Relacionado con: [[Runbook Migraciones Prisma]], [[ADR-003 Prisma sin migraciones versionadas]], [[Riesgo Sin migraciones Prisma versionadas]]
