---
id: modryva-command-<name>
title: Comando <name>
type: command
domain: <moderation|community|casino|ai|admin|utility>
status: <implemented|partial|planned|unknown>
maturity: <stable|beta|unknown>
source:
  - apps/bot/src/bot-update.service.ts
tags:
  - modryva
  - command
  - <domain>
aliases:
  - "/<name>"
created: 2026-07-12
updated: 2026-07-12
---

# Comando /<name>

## Propósito
Qué hace para el usuario.

## Sintaxis
`/<name> <args>` · alias · dónde funciona (grupo/privado).

## Permisos
Rol/permiso requerido. ¿Requiere que el bot sea admin?

## Implementación
Handler (`apps/bot/src/bot-update.service.ts:<símbolo>`), servicio/módulo que ejecuta.

## Efectos
Modelos que toca · eventos que produce · mensajes/acciones de Telegram.

## Errores / edge-cases
Qué puede fallar y cómo responde.

## Tests
Ficheros de test relacionados.

## Relaciones
- Pertenece a: [[Commands Overview]]
- Depende de:
- Produce:
- Consume:
- Relacionado con:
