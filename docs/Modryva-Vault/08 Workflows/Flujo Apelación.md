---
id: modryva-flujo-apelacion
title: Flujo Apelación
type: flow
domain: security
status: partial
maturity: experimental
source:
  - modules/security
  - packages/data/prisma/schema.prisma
tags:
  - modryva
  - flow
  - security
aliases:
  - Flujo de apelaciones
created: 2026-07-12
updated: 2026-07-12
---

# Flujo — apelar una sanción

## Estado
**partial.** El esquema modela apelaciones ([[Modelo Appeal]], [[Modelo D1Appeal]]) y existe una lectura de
historial ([[Comando historial_apelaciones]]), pero el flujo interactivo completo de apertura→revisión→
resolución no está verificado extremo a extremo (`unknown` en partes).

## Disparador
Un usuario sancionado (ban/mute/warn o cuarentena D1) solicita revisión.

## Pasos (según evidencia disponible)
1. **Apertura**: se registra una apelación asociada a la sanción/caso ([[Modelo Appeal]] o
   [[Modelo D1Appeal]] para el sistema D1/cuarentena).
2. **Cola de revisión**: los admins ven las apelaciones/casos pendientes (relación con la bandeja de
   moderación → [[Controller moderation-inbox]]).
3. **Resolución**: un admin acepta (revierte la sanción) o rechaza; se registra el resultado.
4. **Historial**: consultable con [[Comando historial_apelaciones]].

## Preguntas abiertas
- ¿Cómo abre el usuario final la apelación (comando, botón, DM)? `unknown` — confirmar handler.
- ¿Revertir una apelación aceptada deshace automáticamente la acción en Telegram (unban/unmute)? `unknown`.
- Relación exacta [[Modelo Appeal]] (moderación general) vs [[Modelo D1Appeal]] (sistema D1): confirmar.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Depende de: [[Modelo Appeal]], [[Modelo D1Appeal]]
- Relacionado con: [[Flujo Ban]], [[Flujo Warn]], [[Comando historial_apelaciones]], [[Controller moderation-inbox]]
