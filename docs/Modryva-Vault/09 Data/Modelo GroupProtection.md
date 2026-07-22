---
id: modryva-modelo-groupprotection-disambig
title: Modelo GroupProtection
type: model
domain: data
status: unknown
maturity: unknown
source:
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - model
  - data
  - unknown
aliases: []
created: 2026-07-12
updated: 2026-07-12
---

# Modelo GroupProtection — ⚠️ nota de desambiguación (no es un modelo real)

> **No existe un modelo `GroupProtection` en `schema.prisma`.** Es un **nombre inferido** que el agente de
> documentación de la API usó para agrupar la config de "protección de grupo" antes de verificar el esquema
> (ver [[Open Questions]] #16). Se conserva esta nota solo para que los enlaces existentes resuelvan y para
> redirigir a los modelos **reales**.

## A qué modelos reales corresponde según el contexto
Los controllers que lo mencionan anotan su significado; el mapeo real es:

| Uso anotado por el agente | Modelo real |
|---|---|
| `hygiene` (higiene del grupo) | [[Modelo GroupHygieneConfig]] · concepto: [[Group Hygiene]] |
| `membershipGate` / gate de entrada | [[Modelo GroupMembershipGate]] |
| `blocklist` (mode + entries) | [[Modelo BlocklistConfig]] + [[Modelo BlocklistEntry]] |
| protección anti-raid | [[Modelo AntiraidConfig]] |

## Acción pendiente
Sustituir progresivamente los enlaces `[[Modelo GroupProtection]]` en `10 API/` por el modelo real según el
contexto de cada controller/endpoint, y luego borrar esta nota. Rastreado en [[Open Questions]] #16.

## Relaciones
- Pertenece a: [[Database Map]]
- Desambigua hacia: [[Modelo GroupHygieneConfig]], [[Modelo GroupMembershipGate]], [[Modelo BlocklistConfig]]
- Relacionado con: [[Open Questions]], [[Security Map]]
