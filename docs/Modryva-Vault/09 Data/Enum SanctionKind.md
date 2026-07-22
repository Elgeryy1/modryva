---
id: enum-sanctionkind
title: Enum SanctionKind
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - model
  - data
  - enum
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Enum SanctionKind

Tipo de sanción aplicada a un usuario en [[Modelo Sanction]].

## Valores

| Valor | Significado |
|---|---|
| `ban` | Expulsión con bloqueo de reingreso. |
| `mute` | Silenciado (sin permiso de escribir). |
| `restrict` | Restricción parcial de permisos. |
| `warn` | Aviso. |
| `delete` | Borrado de mensaje. |
| `lock` | Bloqueo de contenido/tipo. |

Sin valor por defecto: el `kind` es obligatorio al crear la sanción.

## Usado por

- [[Modelo Sanction]] — campo `kind SanctionKind`.

## Comandos que las producen

[[Comando /ban]], [[Comando /mute]], [[Comando /kick]], [[Comando /warn]], [[Comando /lock]] (y sus
inversos `/unban`, `/unmute`, `/unwarn`). Ver [[Módulo security]].

## Relaciones

- Pertenece a: [[Data Model Overview]]
- Utilizado por: [[Modelo Sanction]]
- Relacionado con: [[Database Map]], [[Security Map]]
