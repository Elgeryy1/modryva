---
id: modryva-model-grouphygieneconfig
title: Modelo GroupHygieneConfig
type: model
domain: data
status: implemented
maturity: stable
source:
  - packages/data/prisma/schema.prisma
  - packages/data/src/group-protection-repository.ts
tags:
  - modryva
  - model
  - data
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo GroupHygieneConfig

## Propósito
Ajustes de "higiene" del grupo por chat: limpieza de mensajes de servicio/bienvenida, modo noche,
mute de bienvenida, auto-aprobación, filtros RTL/CJK, idioma y bloqueo de spammers conocidos vía CAS
(Combot Anti-Spam). Tabla `group_hygiene_configs`.

## Campos clave
| Campo | Tipo | Notas |
|---|---|---|
| `chatId` | String | `@unique`. |
| `cleanService` / `cleanWelcome` | Boolean | Limpieza automática. |
| `nightMode` / `nightStart` / `nightEnd` | Boolean / Int | Modo noche (horas). |
| `welcomeMute` / `autoApprove` | Boolean | Control de entradas. |
| `rtlFilter` / `cjkFilter` | Boolean | Filtros de script. |
| `language` | String | `@default("es")`. |
| `blockKnownSpammers` | Boolean | Auto-ban vía lista CAS pública. |

## Índices / restricciones
`chatId @unique`; `@@index([tenantId])`.

## Enums usados
Ninguno.

## Acceso
`group-protection-repository.ts` (leer/actualizar). Ver [[Módulo security]], [[Settings Panel]].

## Relaciones
- Pertenece a: [[Data Model Overview]]
- Utilizado por: pipeline de limpieza/entrada
- Relacionado con: [[Modelo WelcomeConfig]], [[Modelo ContentLockConfig]], [[Database Map]]
