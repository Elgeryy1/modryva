---
id: endpoint-post-v1-miniapp-groups-gid-wizard-apply
title: Endpoint POST v1 miniapp groups gid wizard apply
type: endpoint
domain: api
status: implemented
maturity: stable
source: [apps/api/src/miniapp/wizard.controller.ts]
tags: [modryva, endpoint, api]
aliases: [POST /v1/miniapp/groups/:gid/wizard/apply]
created: 2026-07-12
updated: 2026-07-12
---

# Endpoint POST v1 miniapp groups gid wizard apply

`apply()` en [[Controller wizard]] (`apps/api/src/miniapp/wizard.controller.ts:337`). Aplica un playbook completo con un nivel de seguridad en una sola operación.

## Entrada

- Path: `:gid`. Body: `{ playbook, security, staffChatId?, logsChatId?, supportChatId? }`; `applyWizardSchema` (`:299`). `security` ∈ `soft`/`normal`/`strict`; `playbook` uno de los 6 ids (`comunidad_limpia`, `ventas_sin_spam`, `solo_miembros_verificados`, `modo_raid`, `anuncios`, `soporte`).
- Cabecera `Authorization: tma <initData>`.

## Salida

`{ ok: true, playbook, security }` (`:374`).

## Efectos

`applyPlaybook` (`:381`) escribe en paralelo captcha, antiflood, locks, cuarentena (d1), welcome+rules y membership gate según el nivel elegido; `applyLogsDestination` (`:433`) fija el canal de logs (`logsChatId` → `staffChatId` → `supportChatId`). Registra auditoría `miniapp.wizard.applied` (`:360`).

## Auth y errores

`@UseGuards(InitDataGuard)` + `assertGroupAdmin`. Errores: 400 `invalid-body`, 400 `invalid-playbook` (`:348`).

## Consumidor

`applyWizardPlaybook(gid, body)` en `apps/web/lib/api-wizard.ts:32`. Los playbooks se listan con `getWizardPlaybooks` (`api-wizard.ts:19`).

## Relaciones

- **Pertenece a**: [[Controller wizard]] / [[API Overview]].
- **Depende de**: [[Guard InitData]], [[Servicio admin]], `@superbot/data`.
- **Utilizado por**: [[Pantalla wizard]] (`applyWizardPlaybook`).
- **Consume**: [[Modelo CaptchaConfig]], [[Modelo AntifloodConfig]], [[Modelo WelcomeConfig]], [[Modelo GroupProtection]], [[Modelo AuditLog]].
- **Relacionado con**: [[Controller config]], [[Controller backup]], [[API Map]].
