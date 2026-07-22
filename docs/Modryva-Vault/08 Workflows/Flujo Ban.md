---
id: modryva-flujo-ban
title: Flujo Ban
type: flow
domain: security
status: implemented
maturity: stable
source:
  - modules/security
  - modules/core
tags:
  - modryva
  - flow
  - security
aliases:
  - Flujo de baneo
created: 2026-07-12
updated: 2026-07-12
---

# Flujo — banear a un usuario

## Disparador
Un admin ejecuta [[Comando ban]] (respondiendo a un mensaje o con `@usuario`/id), **o** una regla de
moderación automática decide expulsar (antispam/antiraid) → [[Sistema de Moderación]].

## Precondiciones
- El bot debe ser **admin con permiso de ban** en el grupo. Si no lo es → modo *companion*: avisa que no
  puede actuar en vez de fingir que baneó (principio de **moderación honesta**, ver [[Módulo security]]).
- El emisor debe superar el chequeo de rol ([[RBAC]] / admin del grupo).

## Pasos
1. **Autorización**: se valida que quien pide el ban puede hacerlo (admin) y que el objetivo es baneable
   (no es admin/owner).
2. **Resolución del objetivo**: se identifica al usuario (reply, mención o id).
3. **Acción en Telegram**: `banChatMember` vía [[Integración Telegram Bot API]].
4. **Persistencia**: se registra la sanción y el motivo (repos de [[Package data]]); queda en `activity-log`.
5. **Feedback honesto**: se confirma el resultado **real** (éxito o el error exacto de Telegram); no se
   afirma éxito si la API falló.

## Ramas y fallos
- **Bot sin permiso** → mensaje "no puedo, hazme admin con permiso de ban" (no error silencioso).
- **Objetivo es admin** → rechazo controlado.
- **Modo silencio activo** → la acción se ejecuta pero se minimizan mensajes no pedidos.
- **Apelación**: si existe flujo de apelación, el ban puede revisarse (ver [[Módulo support]] si aplica;
  estado `unknown` para el flujo formal de apelación).

## Estado observable
`activity-log` (motivo, actor, objetivo, timestamp); logs del bot.

## Relaciones
- Pertenece a: [[Workflows Map]]
- Implementa: [[Comando ban]]
- Depende de: [[Módulo security]], [[Package data]], [[Integración Telegram Bot API]]
- Relacionado con: [[Sistema de Moderación]], [[RBAC]], [[Flujo Update de Telegram]]
