---
id: modryva-flujo-recap-semanal
title: Flujo Recap Semanal
type: flow
domain: community
status: implemented
maturity: stable
source:
  - modules/community
  - apps/worker/src
tags:
  - modryva
  - flow
  - community
aliases:
  - Recap semanal
created: 2026-07-12
updated: 2026-07-12
---

# Flujo — recap semanal del grupo

## Disparador
Un job programado semanal → [[Job recap.weekly]] (orquestado por el worker / scheduler).

## Pasos
1. **Agregación**: se leen métricas de actividad de la semana ([[Modelo ActivityDaily]],
   [[Modelo UserActivity]], `activity-log`): mensajes, usuarios top, altas, etc.
2. **Composición**: se construye un resumen legible (y, en la variante con IA, un texto redactado por el
   [[Módulo ai|proveedor de IA]] a partir de datos ya agregados —no mensajes crudos).
3. **Gate de publicación**: el **modo silencio** es un gate universal de mensajes no pedidos; si está activo
   (o el bot está en modo *companion* sin permiso), el recap NO se envía sin pedirlo.
4. **Entrega**: si procede, se publica el recap en el grupo ([[Integración Telegram Bot API]]).

## Ramas y fallos
- **Semana sin actividad** → recap mínimo o se omite.
- **IA no disponible** → fallback a resumen numérico sin redacción.
- **Bot no admin / modo silencio** → se ofrece bajo demanda en vez de publicar.

## Estado observable
Existencia del mensaje de recap; ejecución del job en logs del worker.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Ejecutado por: [[Job recap.weekly]]
- Depende de: [[Modelo ActivityDaily]], [[Modelo UserActivity]], [[Módulo community]]
- Relacionado con: [[Módulo ai]], [[Comando stats]]
