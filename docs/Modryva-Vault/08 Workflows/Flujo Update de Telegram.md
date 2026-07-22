---
id: modryva-flujo-update-telegram
title: Flujo Update de Telegram
type: flow
domain: bot-core
status: implemented
maturity: stable
source:
  - apps/bot/src
  - packages/telegram/src
tags:
  - modryva
  - flow
  - bot-core
aliases:
  - Ciclo de vida de un update
created: 2026-07-12
updated: 2026-07-12
---

# Flujo — ciclo de vida de un Update de Telegram

> Narrativa del camino feliz de un update entrante. Complemento textual del canvas
> [[Ciclo de vida de un Update]].

## Disparador
Telegram entrega un `Update` al bot por **long-polling** (`getUpdates`), no por webhook en el modo por
defecto → ver [[ADR-002 Bot por long-polling, hijos por webhook]] y [[Long-polling]].

## Pasos
1. **Ingesta**: el loop de polling recibe el `Update` y lo pasa al dispatcher central
   ([[Bot Update Service]] — el "God Object", ver [[Riesgo God Object bot-update]]).
2. **Resolución de bot/tenant**: se determina a qué bot (padre o hijo) y a qué grupo pertenece el update
   ([[Bot Scoping]]); en plataforma multi-bot esto elige el token/tenant correcto.
3. **Clasificación**: se decide el tipo de update → [[Evento message]], [[Evento callback_query]],
   [[Evento chat_member]], [[Evento my_chat_member]], [[Evento chat_join_request]],
   [[Evento pre_checkout_query]] o [[Evento successful_payment]].
4. **Carga de contexto**: se lee la config del grupo ([[Modelo ChatSetting]]) y, si aplica, el estado del
   usuario/miembro. Aquí entra el **modo silencio** como gate universal de mensajes no pedidos.
5. **Dispatch**: según el tipo y el contenido se enruta a un handler:
   - comando (`/...`) → [[Commands Map]] (p. ej. [[Comando ban]], [[Comando casino]]).
   - moderación pasiva (antispam/antiraid/filtros) → [[Módulo security]] / [[Sistema de Moderación]].
   - callback de Mini App / juego → módulo correspondiente.
6. **Ejecución**: el handler llama a la **lógica de dominio pura** del módulo
   ([[ADR-004 Lógica de dominio pura y testeable]]) y a los repos de [[Package data]].
7. **Efectos**: respuesta al usuario vía [[Integración Telegram Bot API]], escritura en BD, y registro en
   `activity-log` cuando aplica.

## Ramas y fallos
- **Update no reconocido / sin permiso**: se ignora o se responde con error controlado.
- **Bot NO es admin**: entra el modo *companion* (avisa/propone en vez de actuar) → ver
  [[Módulo security]] y las features no-admin.
- **Excepción en el handler**: al ser single-consumer, un fallo no tratado puede frenar el consumo →
  [[Riesgo Long-polling single-consumer]].

## Estado observable
Logs del contenedor `ultrabot-bot-1` (ver [[Runbook Desplegar]]); `activity-log` en BD.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Visualizado en: [[Ciclo de vida de un Update]]
- Depende de: [[Bot Update Service]], [[Bot Scoping]], [[Package telegram]]
- Relacionado con: [[Events Map]], [[Modules Map]], [[Security Map]]
